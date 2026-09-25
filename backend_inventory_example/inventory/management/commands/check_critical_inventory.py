from django.core.management.base import BaseCommand

from inventory.services import get_critical_inventory_items


class Command(BaseCommand):
    help = 'Evalúa el stock actual contra el stock mínimo de cada insumo y lista los críticos.'

    def handle(self, *args, **options):
        alerts = get_critical_inventory_items()

        if not alerts:
            self.stdout.write(self.style.SUCCESS('No hay insumos críticos en este momento.'))
            return

        self.stdout.write(self.style.WARNING(f'Se encontraron {len(alerts)} insumos críticos:'))
        for alert in alerts:
            self.stdout.write(
                f"- {alert['name']}: stock={alert['stock']} {alert['unit']} | "
                f"mínimo={alert['threshold']} {alert['unit']} | estado={alert['severity']}"
            )
