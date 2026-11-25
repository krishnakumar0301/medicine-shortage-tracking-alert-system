from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(160), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(40), nullable=False, default="admin")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    transactions: Mapped[list["StockTransaction"]] = relationship(back_populates="user")


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    contact_person: Mapped[str] = mapped_column(String(120), nullable=True)
    phone: Mapped[str] = mapped_column(String(40), nullable=True)
    email: Mapped[str] = mapped_column(String(160), nullable=True)
    address: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    medicines: Mapped[list["Medicine"]] = relationship(back_populates="supplier")
    batches: Mapped[list["Batch"]] = relationship(back_populates="supplier")


class Medicine(Base):
    __tablename__ = "medicines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    medicine_code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    generic_name: Mapped[str] = mapped_column(String(160), nullable=True, index=True)
    brand_name: Mapped[str] = mapped_column(String(160), nullable=True)
    category: Mapped[str] = mapped_column(String(80), nullable=False, default="General", index=True)
    dosage_form: Mapped[str] = mapped_column(String(60), nullable=True)
    strength: Mapped[str] = mapped_column(String(60), nullable=True)
    unit: Mapped[str] = mapped_column(String(20), nullable=False, default="tablets")
    minimum_stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    maximum_stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    storage_location: Mapped[str] = mapped_column(String(80), nullable=True)
    selling_price: Mapped[float] = mapped_column(Float, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    batches: Mapped[list["Batch"]] = relationship(
        back_populates="medicine", cascade="all, delete-orphan"
    )
    transactions: Mapped[list["StockTransaction"]] = relationship(
        back_populates="medicine", cascade="all, delete-orphan"
    )
    alerts: Mapped[list["Alert"]] = relationship(back_populates="medicine", cascade="all, delete-orphan")
    demand_entries: Mapped[list["DemandEntry"]] = relationship(
        back_populates="medicine", cascade="all, delete-orphan"
    )
    supplier_id: Mapped[int | None] = mapped_column(
        ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True
    )
    supplier: Mapped["Supplier | None"] = relationship(back_populates="medicines")


class Batch(Base):
    __tablename__ = "batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    medicine_id: Mapped[int] = mapped_column(
        ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False, index=True
    )
    batch_number: Mapped[str] = mapped_column(String(80), nullable=False)
    manufacturing_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    purchase_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    supplier_id: Mapped[int | None] = mapped_column(
        ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    medicine: Mapped["Medicine"] = relationship(back_populates="batches")
    supplier: Mapped["Supplier | None"] = relationship(back_populates="batches")
    transactions: Mapped[list["StockTransaction"]] = relationship(back_populates="batch")

    __table_args__ = (Index("ix_batch_medicine_expiry", "medicine_id", "expiry_date"),)


class StockTransaction(Base):
    __tablename__ = "stock_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    medicine_id: Mapped[int] = mapped_column(
        ForeignKey("medicines.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    batch_id: Mapped[int | None] = mapped_column(
        ForeignKey("batches.id", ondelete="SET NULL"), nullable=True
    )
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    previous_stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    new_stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reference_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    recipient: Mapped[str | None] = mapped_column(String(160), nullable=True)
    transaction_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    medicine: Mapped["Medicine"] = relationship(back_populates="transactions")
    batch: Mapped["Batch | None"] = relationship(back_populates="transactions")
    user: Mapped["User | None"] = relationship(back_populates="transactions")


class DemandEntry(Base):
    __tablename__ = "demand_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    medicine_id: Mapped[int] = mapped_column(
        ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    quantity_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    medicine: Mapped["Medicine"] = relationship(back_populates="demand_entries")

    __table_args__ = (UniqueConstraint("medicine_id", "date", name="uq_medicine_date"),)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    medicine_id: Mapped[int] = mapped_column(
        ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False, index=True
    )
    alert_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    medicine: Mapped["Medicine"] = relationship(back_populates="alerts")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    notification_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    medicine_id: Mapped[int | None] = mapped_column(
        ForeignKey("medicines.id", ondelete="CASCADE"), nullable=True
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    medicine: Mapped["Medicine | None"] = relationship()


class RestockRequest(Base):
    __tablename__ = "restock_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    medicine_id: Mapped[int] = mapped_column(
        ForeignKey("medicines.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    medicine: Mapped["Medicine"] = relationship()


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    action: Mapped[str] = mapped_column(String(40), nullable=False)
    details: Mapped[str] = mapped_column(Text, nullable=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
