from decimal import Decimal

from .models import InventoryItem


def get_critical_inventory_items():
    alerts = []

    for item in InventoryItem.objects.all():
        threshold = Decimal(str(item.stock_minimo)) if item.stock_minimo is not None else Decimal('0')
        stock = Decimal(str(item.stock))

        if stock <= threshold:
            alerts.append({
                'id': item.id,
                'name': item.name,
                'stock': str(item.stock),
                'unit': item.unit,
                'threshold': str(threshold),
                'severity': 'critical' if stock <= 0 else 'warning',
                'message': 'Sin stock disponible' if stock <= 0 else 'Stock por debajo del mínimo recomendado',
            })

    return alerts
