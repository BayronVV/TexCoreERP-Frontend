from decimal import Decimal

from django.conf import settings
from django.db import models


class InventoryItem(models.Model):
    name = models.CharField(max_length=255)
    stock = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    stock_minimo = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    unit = models.CharField(max_length=50, default='kg')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class InventoryMovement(models.Model):
    MOVEMENT_TYPES = (
        ('INGRESO', 'Ingreso'),
        ('SALIDA', 'Salida'),
    )

    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='movements')
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPES)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    stock_before = models.DecimalField(max_digits=12, decimal_places=2)
    stock_after = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=255, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.item.name} - {self.movement_type} - {self.quantity}'
