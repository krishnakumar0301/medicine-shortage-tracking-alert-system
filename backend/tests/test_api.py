import os
import tempfile
from datetime import date, datetime, timedelta

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.gettempdir()}/test_medtrack.db"
os.environ["SEED_ON_STARTUP"] = "false"
os.environ["SECRET_KEY"] = "test-secret-key"

import pytest
from fastapi.testclient import TestClient

from app.auth import hash_password
from app.database import Base, SessionLocal, engine, get_db
from app.main import app
from app import models

if os.path.exists(f"{tempfile.gettempdir()}/test_medtrack.db"):
    os.remove(f"{tempfile.gettempdir()}/test_medtrack.db")


@pytest.fixture()
def client():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    user = models.User(
        username="tester",
        email="tester@test.local",
        password_hash=hash_password("testpass123"),
        role="admin",
    )
    db.add(user)
    supplier = models.Supplier(name="Test Supplier", status="active")
    db.add(supplier)
    db.flush()
    db.add(
        models.Setting(key="expiry_warning_days", value="30")
    )
    db.commit()
    db.close()

    def override_get_db():
        try:
            db = SessionLocal()
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        login = c.post("/api/auth/login", json={"username": "tester", "password": "testpass123"})
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
        c.headers.update({"Authorization": f"Bearer {token}"})
        yield c

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


def _create_medicine(client, name="Testolol", qty=50, minimum=10, maximum=100, expiry_days=300):
    payload = {
        "name": name,
        "generic_name": name,
        "category": "Analgesic",
        "dosage_form": "Tablets",
        "strength": "500mg",
        "unit": "tablets",
        "minimum_stock": minimum,
        "maximum_stock": maximum,
        "storage_location": "Shelf A",
        "batch": {
            "batch_number": "TB-1001",
            "manufacturing_date": (date.today() - timedelta(days=60)).isoformat(),
            "expiry_date": (date.today() + timedelta(days=expiry_days)).isoformat(),
            "quantity": qty,
            "purchase_price": 2.5,
        },
    }
    resp = client.post("/api/medicines", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------- Auth ----------------
def test_login_success(client):
    resp = client.post("/api/auth/login", json={"username": "tester", "password": "testpass123"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_login_wrong_password(client):
    resp = client.post("/api/auth/login", json={"username": "tester", "password": "wrong"})
    assert resp.status_code == 401


def test_protected_route_requires_token(client):
    resp = client.get("/api/medicines")
    assert resp.status_code == 200


def test_no_token_rejected():
    with TestClient(app) as c:
        resp = c.get("/api/medicines")
        assert resp.status_code == 401


# ---------------- Medicines ----------------
def test_create_medicine(client):
    m = _create_medicine(client)
    assert m["current_stock"] == 50
    assert m["stock_status"] == "healthy"


def test_create_duplicate_name_rejected(client):
    _create_medicine(client, name="DupMed")
    resp = client.post(
        "/api/medicines",
        json={"name": "DupMed", "minimum_stock": 5, "maximum_stock": 50},
    )
    assert resp.status_code == 400


def test_create_invalid_dates(client):
    payload = {
        "name": "BadDates",
        "minimum_stock": 5,
        "maximum_stock": 50,
        "batch": {
            "batch_number": "BD-1",
            "manufacturing_date": "2026-06-01",
            "expiry_date": "2026-01-01",
            "quantity": 10,
        },
    }
    resp = client.post("/api/medicines", json=payload)
    assert resp.status_code == 422


def test_medicine_list_filters(client):
    _create_medicine(client, name="FilterMed")
    resp = client.get("/api/medicines?search=FilterMed")
    assert resp.json()["total"] == 1


def test_update_medicine(client):
    m = _create_medicine(client)
    resp = client.put(f"/api/medicines/{m['id']}", json={"minimum_stock": 25})
    assert resp.status_code == 200
    assert resp.json()["minimum_stock"] == 25


def test_delete_medicine_deactivates_with_history(client):
    m = _create_medicine(client)
    client.post(f"/api/stock/out?medicine_id={m['id']}", json={"quantity": 5})
    resp = client.delete(f"/api/medicines/{m['id']}")
    assert resp.status_code == 200
    assert "preserved" in resp.json()["message"]


# ---------------- Stock business rules ----------------
def test_restock_updates_stock_and_creates_transaction(client):
    m = _create_medicine(client, name="RestockMed", qty=15)
    assert m["current_stock"] == 15
    resp = client.post(
        f"/api/stock/in?medicine_id={m['id']}",
        json={
            "quantity": 100,
            "batch_number": "RB-2001",
            "manufacturing_date": (date.today() - timedelta(days=10)).isoformat(),
            "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
        },
    )
    assert resp.status_code == 201
    txn = resp.json()
    assert txn["previous_stock"] == 15
    assert txn["new_stock"] == 115
    m2 = client.get(f"/api/medicines/{m['id']}").json()
    assert m2["current_stock"] == 115

    hist = client.get(f"/api/medicines/{m['id']}/history").json()
    in_txns = [t for t in hist["items"] if t["transaction_type"] == "in"]
    assert len(in_txns) >= 2


def test_issue_decreases_stock(client):
    m = _create_medicine(client, name="IssueMed", qty=50)
    resp = client.post(
        f"/api/stock/out?medicine_id={m['id']}",
        json={"quantity": 20, "recipient": "Ward A", "reference_number": "ISS-1"},
    )
    assert resp.status_code == 201
    m2 = client.get(f"/api/medicines/{m['id']}").json()
    assert m2["current_stock"] == 30


def test_issue_more_than_stock_rejected(client):
    m = _create_medicine(client, name="LowMed", qty=10)
    resp = client.post(
        f"/api/stock/out?medicine_id={m['id']}",
        json={"quantity": 11},
    )
    assert resp.status_code == 400
    assert "Insufficient" in resp.json()["detail"]


def test_fefo_uses_earliest_batch_first(client):
    m = _create_medicine(client, name="FefoMed", qty=50, expiry_days=300)
    mid = m["id"]
    client.post(
        f"/api/stock/in?medicine_id={mid}",
        json={
            "quantity": 30,
            "batch_number": "FE-2",
            "manufacturing_date": "2026-01-01",
            "expiry_date": (date.today() + timedelta(days=10)).isoformat(),
        },
    )
    recs = client.get(f"/api/stock/fefo/{mid}").json()
    assert recs[0]["use_first"] is True
    assert recs[0]["days_remaining"] <= recs[1]["days_remaining"]

    # Issue 60 -> should consume early batch (30) first, then 30 of the later batch
    client.post(
        f"/api/stock/out?medicine_id={mid}",
        json={"quantity": 60},
    )
    detail = client.get(f"/api/medicines/{mid}").json()
    batches = {b["batch_number"]: b["quantity"] for b in detail["batches"]}
    assert batches["FE-2"] == 0
    assert batches["TB-1001"] == 20


def test_expired_batch_not_issuable(client):
    m = _create_medicine(client, name="ExpiryMed", qty=50, expiry_days=300)
    mid = m["id"]
    client.post(
        f"/api/stock/in?medicine_id={mid}",
        json={
            "quantity": 20,
            "batch_number": "EX-1",
            "manufacturing_date": "2025-01-01",
            "expiry_date": (date.today() - timedelta(days=3)).isoformat(),
        },
    )
    # issuing should consume only the good batch, never the expired one
    client.post(f"/api/stock/out?medicine_id={mid}", json={"quantity": 50})
    detail = client.get(f"/api/medicines/{mid}").json()
    batches = {b["batch_number"]: b["quantity"] for b in detail["batches"]}
    assert batches["EX-1"] == 20  # untouched expired batch
    assert batches["TB-1001"] == 0


def test_adjustment_creates_transaction(client):
    m = _create_medicine(client, name="AdjMed", qty=40)
    resp = client.post(
        f"/api/stock/adjust?medicine_id={m['id']}",
        json={"quantity": 5, "adjustment_type": "in", "reason": "count correction"},
    )
    assert resp.status_code == 200
    m2 = client.get(f"/api/medicines/{m['id']}").json()
    assert m2["current_stock"] == 45
    hist = client.get(f"/api/medicines/{m['id']}/history").json()
    adj = [t for t in hist["items"] if t["transaction_type"] == "adjustment"]
    assert len(adj) == 1


# ---------------- Alerts / Expiry ----------------
def test_shortage_alert_generated(client):
    m = _create_medicine(client, name="ShortMed", qty=12, minimum=20)
    alerts = client.get("/api/alerts").json()
    matching = [a for a in alerts if a["medicine_id"] == m["id"]]
    assert any(a["alert_type"] == "low_stock" for a in matching)


def test_out_of_stock_alert(client):
    m = _create_medicine(client, name="OOSMed", qty=5)
    client.post(f"/api/stock/out?medicine_id={m['id']}", json={"quantity": 5})
    alerts = client.get("/api/alerts").json()
    matching = [a for a in alerts if a["medicine_id"] == m["id"]]
    assert any(a["alert_type"] == "out_of_stock" for a in matching)


def test_expiring_soon_alert(client):
    m = _create_medicine(client, name="ExpSoonMed", qty=10, expiry_days=10)
    alerts = client.get("/api/alerts").json()
    matching = [a for a in alerts if a["medicine_id"] == m["id"]]
    assert any(a["alert_type"] == "expiring_soon" for a in matching)


def test_expiry_monitor_statuses(client):
    _create_medicine(client, name="SafeMed", qty=10, expiry_days=300)
    _create_medicine(client, name="SoonMed", qty=10, expiry_days=10)
    data = client.get("/api/expiry").json()
    statuses = {r["medicine_name"]: r["status"] for r in data["items"]}
    assert statuses["SafeMed"] == "safe"
    assert statuses["SoonMed"] == "expiring_soon"


# ---------------- Predictions ----------------
def test_prediction_returns_recommendations(client):
    m = _create_medicine(client, name="PredMed", qty=100)
    pred = client.get(f"/api/predictions/{m['id']}").json()
    assert "predicted_next_month" in pred
    assert "recommended_reorder_qty" in pred
    assert "estimate" in pred["note"].lower()


# ---------------- Suppliers ----------------
def test_supplier_crud(client):
    resp = client.post("/api/suppliers", json={"name": "Supplier A", "phone": "123"})
    assert resp.status_code == 201
    sid = resp.json()["id"]
    resp = client.put(f"/api/suppliers/{sid}", json={"contact_person": "Bob"})
    assert resp.json()["contact_person"] == "Bob"
    resp = client.delete(f"/api/suppliers/{sid}")
    assert resp.status_code == 200


# ---------------- Search / Reports ----------------
def test_search_finds_medicine(client):
    _create_medicine(client, name="SearchableMed")
    resp = client.get("/api/search?q=SearchableMed")
    assert resp.json()["medicines"][0]["name"] == "SearchableMed"


def test_reports_endpoints(client):
    _create_medicine(client, name="ReportMed", qty=30, minimum=5)
    inv = client.get("/api/reports/inventory")
    assert inv.status_code == 200
    shortage = client.get("/api/reports/shortage")
    assert shortage.status_code == 200
    assert "text/csv" in shortage.headers["content-type"]


def test_dashboard_stats(client):
    _create_medicine(client, name="DashMed", qty=30)
    data = client.get("/api/dashboard").json()
    keys = {s["key"] for s in data["stats"]}
    assert "total_medicines" in keys
    assert data["health_score"] >= 0
    assert data["health_score"] <= 100
