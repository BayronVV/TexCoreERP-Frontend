from django.urls import path

from .views import InventoryMovementCreateView

urlpatterns = [
    path('inventory/movements/', InventoryMovementCreateView.as_view(), name='inventory_movements_create'),
]
