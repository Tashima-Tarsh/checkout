"""Paperclip Adapter - Company and Employee Management Integration.

Provides executable integration with Paperclip company/employee management
system. Maps Paperclip concepts to Agentic-Recovery's tenant/employee model.

Upstream: https://github.com/paperclipai/paperclip.git
Pinned SHA: dadbc495b3cbdc171fddc40d09aafcc3e9206305
"""

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class PaperclipCompany:
    """Company record from Paperclip."""
    company_id: str
    name: str
    owner_id: Optional[str] = None
    created_at: Optional[str] = None


@dataclass
class PaperclipEmployee:
    """Employee record from Paperclip."""
    employee_id: str
    company_id: str
    name: str
    email: Optional[str] = None
    role: Optional[str] = None
    assigned_device_id: Optional[str] = None
    assigned_receiver_upi: Optional[str] = None
    is_active: bool = True


class PaperclipAdapter:
    """Adapter for Paperclip company/employee management.

    Maps Paperclip API responses to Agentic-Recovery tenant/employee models.
    No upstream source code is executed - this is a pure adapter layer.
    """

    def __init__(self, api_base_url: str, api_key: str):
        self.api_base_url = api_base_url
        self.api_key = api_key

    def map_company_to_tenant(self, company: PaperclipCompany) -> dict:
        """Map Paperclip company to Agentic-Recovery tenant."""
        return {
            "id": company.company_id,
            "name": company.name,
            "owner_id": company.owner_id,
        }

    def map_employee_to_recovery_employee(self, employee: PaperclipEmployee) -> dict:
        """Map Paperclip employee to Agentic-Recovery employee."""
        return {
            "id": employee.employee_id,
            "tenant_id": employee.company_id,
            "name": employee.name,
            "email": employee.email,
            "role": employee.role or "recovery_employee",
            "assigned_receiver_upi": employee.assigned_receiver_upi,
        }

    def map_employee_to_device_assignment(self, employee: PaperclipEmployee) -> Optional[dict]:
        """Map employee device assignment."""
        if not employee.assigned_device_id:
            return None
        return {
            "employee_id": employee.employee_id,
            "device_id": employee.assigned_device_id,
        }

    def fetch_companies(self) -> List[PaperclipCompany]:
        """Fetch companies from Paperclip API."""
        # Implementation would call Paperclip API
        # For now, returns empty list - adapter is a template
        return []

    def fetch_employees(self, company_id: str) -> List[PaperclipEmployee]:
        """Fetch employees from Paperclip API."""
        # Implementation would call Paperclip API
        # For now, returns empty list - adapter is a template
        return []