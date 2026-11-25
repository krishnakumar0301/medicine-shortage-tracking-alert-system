from datetime import date, timedelta

from sqlalchemy.orm import Session

from . import models
from .auth import hash_password
from .config import settings
from .database import get_session


def _mk_supplier(db: Session, name: str, contact: str, phone: str, email: str, address: str) -> models.Supplier:
    supplier = models.Supplier(
        name=name, contact_person=contact, phone=phone, email=email, address=address, status="active"
    )
    db.add(supplier)
    return supplier


def _mk_medicine(
    db: Session,
    code: str,
    name: str,
    generic: str,
    brand: str,
    category: str,
    dosage_form: str,
    strength: str,
    unit: str,
    minimum: int,
    maximum: int,
    location: str,
    price: float,
    supplier: models.Supplier,
    description: str,
) -> models.Medicine:
    medicine = models.Medicine(
        medicine_code=code,
        name=name,
        generic_name=generic,
        brand_name=brand,
        category=category,
        dosage_form=dosage_form,
        strength=strength,
        unit=unit,
        minimum_stock=minimum,
        maximum_stock=maximum,
        storage_location=location,
        selling_price=price,
        supplier_id=supplier.id,
        description=description,
    )
    db.add(medicine)
    return medicine


def _mk_batch(
    db: Session,
    medicine: models.Medicine,
    batch_number: str,
    mfg: date,
    expiry: date,
    qty: int,
    purchase_price: float,
    supplier: models.Supplier,
) -> models.Batch:
    batch = models.Batch(
        medicine_id=medicine.id,
        batch_number=batch_number,
        manufacturing_date=mfg,
        expiry_date=expiry,
        quantity=qty,
        purchase_price=purchase_price,
        supplier_id=supplier.id,
    )
    db.add(batch)
    return batch


def _mk_txn(
    db: Session,
    medicine: models.Medicine,
    batch: models.Batch,
    txn_type: str,
    quantity: int,
    prev: int,
    new: int,
    days_ago: int,
    reference: str,
    user_id: int,
    notes: str | None = None,
):
    db.add(
        models.StockTransaction(
            medicine_id=medicine.id,
            batch_id=batch.id,
            transaction_type=txn_type,
            quantity=quantity,
            previous_stock=prev,
            new_stock=new,
            reference_number=reference,
            transaction_date=datetime_utcnow() - timedelta(days=days_ago),
            notes=notes,
            user_id=user_id,
        )
    )


def datetime_utcnow():
    from datetime import datetime

    return datetime.utcnow()


def _seed_demand(db: Session, medicine: models.Medicine, days: int, base: int, variability: float = 0.25):
    import random

    random.seed(hash(medicine.name) % 10000)
    today = date.today()
    for i in range(days, 0, -1):
        d = today - timedelta(days=i)
        if d.weekday() >= 5:
            continue
        usage = max(1, int(base * (1 + random.uniform(-variability, variability))))
        db.add(models.DemandEntry(medicine_id=medicine.id, date=d, quantity_used=usage))


def seed_if_needed():
    if not settings.SEED_ON_STARTUP:
        return
    db = get_session()
    try:
        if db.query(models.User).count() > 0:
            return
        seed_database(db)
    finally:
        db.close()


def seed_database(db: Session):
    today = date.today()

    admin = models.User(
        username=settings.DEMO_USERNAME,
        email=settings.DEMO_EMAIL,
        password_hash=hash_password(settings.DEMO_PASSWORD),
        role="admin",
    )
    db.add(admin)
    db.flush()

    pharma_sys = models.User(
        username="pharmacist",
        email="pharmacist@medtrack.local",
        password_hash=hash_password("pharma123"),
        role="pharmacist",
    )
    db.add(pharma_sys)
    db.flush()

    # ---------- Suppliers ----------
    s1 = _mk_supplier(db, "MediCore Distributors", "Arun Sharma", "+91-98765-43210", "orders@medicore.example", "Plot 12, Sector 18, Pune")
    s2 = _mk_supplier(db, "HealthBridge Pharma", "Priya Menon", "+91-91234-56780", "sales@healthbridge.example", "No. 44, MG Road, Bengaluru")
    s3 = _mk_supplier(db, "LifeLine Supplies", "Rahul Verma", "+91-99887-76655", "support@lifeline.example", "Warehouse 8, Transport Nagar, Delhi")
    s4 = _mk_supplier(db, "NovaDrug Wholesale", "Sneha Iyer", "+91-97766-55443", "contact@novadrug.example", "Unit 3, Anna Salai, Chennai")
    db.flush()

    # ---------- Medicines ----------
    para = _mk_medicine(
        db, "PARA-0001", "Paracetamol", "Paracetamol", "Tylenol", "Analgesic", "Tablets", "500mg",
        "tablets", 20, 200, "Shelf A-01", 2.5, s1, "Common analgesic and antipyretic.")
    amox = _mk_medicine(
        db, "AMOX-0002", "Amoxicillin", "Amoxicillin", "Amoxil", "Antibiotic", "Capsules", "500mg",
        "capsules", 30, 150, "Shelf B-02", 12.0, s2, "Broad-spectrum penicillin antibiotic.")
    ibu = _mk_medicine(
        db, "IBU-0003", "Ibuprofen", "Ibuprofen", "Advil", "Analgesic", "Tablets", "400mg",
        "tablets", 15, 120, "Shelf A-03", 4.5, s1, "NSAID for pain and inflammation.")
    cet = _mk_medicine(
        db, "CET-0004", "Cetirizine", "Cetirizine HCl", "Zyrtec", "Antihistamine", "Tablets", "10mg",
        "tablets", 10, 90, "Shelf C-01", 3.0, s3, "Antihistamine for allergy relief.")
    azi = _mk_medicine(
        db, "AZI-0005", "Azithromycin", "Azithromycin", "Zithromax", "Antibiotic", "Tablets", "250mg",
        "tablets", 25, 100, "Shelf B-04", 18.0, s2, "Macrolide antibiotic.")
    met = _mk_medicine(
        db, "MET-0006", "Metformin", "Metformin HCl", "Glucophage", "Antidiabetic", "Tablets", "500mg",
        "tablets", 40, 300, "Shelf D-01", 2.0, s4, "First-line medication for type 2 diabetes.")
    ome = _mk_medicine(
        db, "OME-0007", "Omeprazole", "Omeprazole", "Prilosec", "PPI", "Capsules", "20mg",
        "capsules", 20, 120, "Shelf D-02", 6.0, s4, "Proton pump inhibitor for acid reflux.")
    ors = _mk_medicine(
        db, "ORS-0008", "Oral Rehydration Salts", "ORS", "Electral", "Electrolyte", "Powder", "21.8g sachet",
        "sachets", 50, 400, "Shelf E-01", 5.0, s3, "Oral rehydration for dehydration.")
    asc = _mk_medicine(
        db, "ASC-0009", "Ascorbic Acid", "Vitamin C", "Celin", "Vitamin", "Tablets", "500mg",
        "tablets", 25, 150, "Shelf E-02", 1.5, s1, "Vitamin C supplement.")
    lev = _mk_medicine(
        db, "LEV-0010", "Levofloxacin", "Levofloxacin", "Tavanic", "Antibiotic", "Tablets", "500mg",
        "tablets", 20, 80, "Shelf B-05", 22.0, s2, "Fluoroquinolone antibiotic.")
    db.flush()

    # ---------- Batches (multiple scenarios) ----------
    # Paracetamol: multiple batches, FEFO demo (one expiring soon)
    batch_para_a = _mk_batch(db, para, "PARA-B101", today - timedelta(days=300), today + timedelta(days=240), 80, 1.8, s1)
    batch_para_b = _mk_batch(db, para, "PARA-B118", today - timedelta(days=120), today + timedelta(days=18), 35, 1.9, s1)
    # Amoxicillin: low stock
    batch_amox = _mk_batch(db, amox, "AMOX-B205", today - timedelta(days=200), today + timedelta(days=160), 12, 9.0, s2)
    # Ibuprofen: healthy
    batch_ibu = _mk_batch(db, ibu, "IBU-B301", today - timedelta(days=180), today + timedelta(days=310), 95, 3.2, s1)
    # Cetirizine: out of stock (zero quantity batch kept for history)
    _mk_batch(db, cet, "CET-B401", today - timedelta(days=260), today + timedelta(days=40), 0, 2.1, s3)
    # Azithromycin: expiring soon + expired batch
    batch_azi = _mk_batch(db, azi, "AZI-B501", today - timedelta(days=90), today + timedelta(days=12), 30, 14.0, s2)
    _mk_batch(db, azi, "AZI-B488", today - timedelta(days=400), today - timedelta(days=5), 5, 14.0, s2)  # expired
    # Metformin: healthy with two batches
    batch_met_a = _mk_batch(db, met, "MET-B601", today - timedelta(days=400), today + timedelta(days=200), 120, 1.4, s4)
    _mk_batch(db, met, "MET-B615", today - timedelta(days=90), today + timedelta(days=300), 130, 1.5, s4)
    # Omeprazole: low
    batch_ome = _mk_batch(db, ome, "OME-B701", today - timedelta(days=150), today + timedelta(days=45), 18, 4.5, s4)
    # ORS: critical (near min)
    batch_ors = _mk_batch(db, ors, "ORS-B801", today - timedelta(days=60), today + timedelta(days=365), 55, 3.0, s3)
    # Ascorbic acid: healthy
    _mk_batch(db, asc, "ASC-B901", today - timedelta(days=220), today + timedelta(days=500), 110, 1.0, s1)
    # Levofloxacin: healthy
    _mk_batch(db, lev, "LEV-B1001", today - timedelta(days=130), today + timedelta(days=210), 45, 16.0, s2)
    db.flush()

    # ---------- Transactions (history) ----------

    _mk_txn(db, para, batch_para_a, "in", 100, 0, 100, 30, "IN-PURCH-8841", admin.id)
    _mk_txn(db, para, batch_para_b, "in", 50, 100, 150, 20, "IN-PURCH-8890", admin.id)
    _mk_txn(db, para, batch_para_a, "out", 20, 150, 130, 15, "ISS-WARD-1002", admin.id)
    _mk_txn(db, para, batch_para_a, "out", 15, 130, 115, 8, "ISS-PAT-2031", admin.id)

    _mk_txn(db, amox, batch_amox, "in", 60, 0, 60, 25, "IN-PURCH-8830", admin.id)
    _mk_txn(db, amox, batch_amox, "out", 48, 60, 12, 3, "ISS-WARD-1099", admin.id)

    _mk_txn(db, ibu, batch_ibu, "in", 120, 0, 120, 18, "IN-PURCH-8821", admin.id)
    _mk_txn(db, ibu, batch_ibu, "out", 25, 120, 95, 6, "ISS-PAT-2035", admin.id)

    _mk_txn(db, azi, batch_azi, "in", 40, 0, 40, 14, "IN-PURCH-8845", admin.id)
    _mk_txn(db, azi, batch_azi, "out", 10, 40, 30, 4, "ISS-WARD-1101", admin.id)

    _mk_txn(db, met, batch_met_a, "in", 250, 0, 250, 45, "IN-PURCH-8801", admin.id)
    _mk_txn(db, met, batch_met_a, "out", 130, 250, 120, 10, "ISS-WARD-1055", admin.id)

    _mk_txn(db, ome, batch_ome, "in", 50, 0, 50, 12, "IN-PURCH-8840", admin.id)
    _mk_txn(db, ome, batch_ome, "out", 32, 50, 18, 2, "ISS-PAT-2040", admin.id)

    _mk_txn(db, ors, batch_ors, "in", 80, 0, 80, 9, "IN-PURCH-8850", admin.id)
    _mk_txn(db, ors, batch_ors, "out", 25, 80, 55, 1, "ISS-EMER-300", admin.id)

    # ---------- Demand history ----------
    _seed_demand(db, para, 120, 12)
    _seed_demand(db, amox, 120, 9)
    _seed_demand(db, ibu, 120, 7)
    _seed_demand(db, cet, 120, 5)
    _seed_demand(db, azi, 120, 6)
    _seed_demand(db, met, 120, 10)
    _seed_demand(db, ome, 120, 6)
    _seed_demand(db, ors, 120, 4)
    _seed_demand(db, asc, 120, 8)
    _seed_demand(db, lev, 120, 3)

    # ---------- Restock request ----------
    db.add(
        models.RestockRequest(
            medicine_id=amox.id,
            quantity=80,
            reason="Stock approaching minimum level",
            status="pending",
        )
    )
    db.add(
        models.RestockRequest(
            medicine_id=cet.id,
            quantity=60,
            reason="Currently out of stock",
            status="ordered",
        )
    )

    db.add(
        models.Setting(key="expiry_warning_days", value=str(settings.EXPIRY_WARNING_DAYS))
    )

    db.commit()
