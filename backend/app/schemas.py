from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth ----------
class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class UserOut(ORMModel):
    id: int
    username: str
    email: str
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Supplier ----------
class SupplierBase(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    status: str = "active"


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    status: str | None = None


class SupplierOut(ORMModel):
    id: int
    name: str
    contact_person: str | None
    phone: str | None
    email: str | None
    address: str | None
    status: str
    created_at: datetime


# ---------- Medicine ----------
class MedicineBase(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    generic_name: str | None = None
    brand_name: str | None = None
    category: str = "General"
    dosage_form: str | None = None
    strength: str | None = None
    unit: str = "tablets"
    minimum_stock: int = Field(default=0, ge=0)
    maximum_stock: int = Field(default=0, ge=0)
    storage_location: str | None = None
    selling_price: float | None = Field(default=None, ge=0)
    description: str | None = None
    supplier_id: int | None = None


class BatchIn(BaseModel):
    batch_number: str = Field(min_length=1, max_length=80)
    manufacturing_date: date | None = None
    expiry_date: date | None = None
    quantity: int = Field(gt=0)
    purchase_price: float | None = Field(default=None, ge=0)
    supplier_id: int | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.expiry_date and self.manufacturing_date:
            if self.expiry_date < self.manufacturing_date:
                raise ValueError("Expiry date must not be earlier than manufacturing date.")
        return self


class MedicineCreate(MedicineBase):
    batch: BatchIn | None = None


class MedicineUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    generic_name: str | None = None
    brand_name: str | None = None
    category: str | None = None
    dosage_form: str | None = None
    strength: str | None = None
    unit: str | None = None
    minimum_stock: int | None = Field(default=None, ge=0)
    maximum_stock: int | None = Field(default=None, ge=0)
    storage_location: str | None = None
    selling_price: float | None = Field(default=None, ge=0)
    description: str | None = None
    supplier_id: int | None = None


class BatchOut(ORMModel):
    id: int
    medicine_id: int
    batch_number: str
    manufacturing_date: date | None
    expiry_date: date | None
    quantity: int
    purchase_price: float | None
    supplier_id: int | None


class MedicineOut(ORMModel):
    id: int
    medicine_code: str
    name: str
    generic_name: str | None
    brand_name: str | None
    category: str
    dosage_form: str | None
    strength: str | None
    unit: str
    minimum_stock: int
    maximum_stock: int
    storage_location: str | None
    selling_price: float | None
    description: str | None
    supplier_id: int | None
    is_active: bool
    created_at: datetime


class MedicineDetailOut(MedicineOut):
    current_stock: int
    stock_status: str
    batches: list[BatchOut]
    supplier: SupplierOut | None = None


class MedicineListItem(MedicineOut):
    current_stock: int
    stock_status: str
    expiry_status: str
    days_to_expiry: int | None
    earliest_expiry: date | None
    alert_count: int = 0
    avg_monthly_usage: float = 0.0
    last_restocked: datetime | None = None
    last_issued: datetime | None = None


# ---------- Stock ----------
class StockIn(BaseModel):
    quantity: int = Field(gt=0)
    batch_number: str = Field(min_length=1, max_length=80)
    manufacturing_date: date | None = None
    expiry_date: date | None = None
    purchase_price: float | None = Field(default=None, ge=0)
    supplier_id: int | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.expiry_date and self.manufacturing_date:
            if self.expiry_date < self.manufacturing_date:
                raise ValueError("Expiry date must not be earlier than manufacturing date.")
        return self


class StockOut(BaseModel):
    quantity: int = Field(gt=0)
    batch_id: int | None = None
    reference_number: str | None = None
    recipient: str | None = None
    notes: str | None = None


class StockAdjust(BaseModel):
    quantity: int = Field(gt=0)
    batch_id: int | None = None
    adjustment_type: str = "in"  # or "out"
    reason: str | None = None


class TransactionOut(ORMModel):
    id: int
    medicine_id: int
    batch_id: int | None
    transaction_type: str
    quantity: int
    previous_stock: int
    new_stock: int
    reference_number: str | None
    recipient: str | None
    transaction_date: datetime
    notes: str | None
    user_id: int | None


class BatchCreate(BaseModel):
    medicine_id: int
    batch_number: str = Field(min_length=1, max_length=80)
    manufacturing_date: date | None = None
    expiry_date: date | None = None
    quantity: int = Field(gt=0)
    purchase_price: float | None = None
    supplier_id: int | None = None


class TransactionDetail(TransactionOut):
    medicine_name: str | None = None
    batch_number: str | None = None


# ---------- Alerts / Notifications ----------
class AlertOut(ORMModel):
    id: int
    medicine_id: int
    alert_type: str
    priority: int
    message: str
    status: str
    created_at: datetime


class NotificationOut(ORMModel):
    id: int
    notification_type: str
    title: str
    message: str
    medicine_id: int | None
    is_read: bool
    created_at: datetime


# ---------- Demand / Prediction ----------
class DemandOut(ORMModel):
    id: int
    medicine_id: int
    date: date
    quantity_used: int


class PredictionOut(BaseModel):
    medicine_id: int
    medicine_name: str
    current_stock: int
    avg_daily_usage: float
    avg_monthly_usage: float
    predicted_next_month: float
    safety_stock: float
    lead_time_demand: float
    reorder_point: float
    recommended_reorder_qty: float
    forecast: list[dict]
    note: str = "Prediction is an estimate for planning purposes only, not medical advice."


class RestockRequestOut(ORMModel):
    id: int
    medicine_id: int
    quantity: int
    reason: str | None
    status: str
    created_at: datetime


class RestockRequestCreate(BaseModel):
    medicine_id: int
    quantity: int = Field(gt=0)
    reason: str | None = None


# ---------- Dashboard ----------
class StatCard(BaseModel):
    key: str
    label: str
    value: int | float
    sub: str | None = None


class AlertItem(BaseModel):
    type: str
    priority: int
    message: str
    medicine_id: int | None = None
    medicine_name: str | None = None
    current_stock: int | None = None


class TimelineEvent(BaseModel):
    date: datetime
    type: str
    text: str
    medicine_id: int | None = None
    medicine_name: str | None = None


class PriorityItem(BaseModel):
    medicine_id: int
    medicine_name: str
    current_stock: int
    minimum_stock: int
    priority: str
    priority_score: int
    recommended_reorder: float


class DashboardData(BaseModel):
    stats: list[StatCard]
    alerts: list[AlertItem]
    timeline: list[TimelineEvent]
    priorities: list[PriorityItem]
    stock_by_category: list[dict]
    monthly_usage: list[dict]
    stock_in_out: list[dict]
    expiry_distribution: list[dict]
    health_score: float
    health_label: str
