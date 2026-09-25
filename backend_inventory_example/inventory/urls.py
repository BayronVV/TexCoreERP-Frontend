from django.urls import path

from .views import InventoryAlertListView, InventoryMovementCreateView

urlpatterns = [
    path('inventory/alerts/', InventoryAlertListView.as_view(), name='inventory_alerts'),
    path('inventory/movements/', InventoryMovementCreateView.as_view(), name='inventory_movements_create'),
]
