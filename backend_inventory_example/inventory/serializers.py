from rest_framework import serializers

from .models import InventoryItem, InventoryMovement


class InventoryItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryItem
        fields = ['id', 'name', 'stock', 'unit', 'created_at']


class InventoryMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryMovement
        fields = [
            'id',
            'item',
            'movement_type',
            'quantity',
            'stock_before',
            'stock_after',
            'reference',
            'notes',
            'created_by',
            'created_at',
        ]
        read_only_fields = ['id', 'stock_before', 'stock_after', 'created_by', 'created_at']
