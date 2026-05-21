#!/usr/bin/env python3
"""Populate the FacturaBot MongoDB with example data for all collections."""

import argparse
import os
import sys
from datetime import datetime, timedelta
from bson import ObjectId

import pymongo
from dotenv import load_dotenv


# --- MongoDB collection names (Mongoose default pluralization) ---
COLL_INVENTORY = "inventories"
COLL_TRANSACTIONS = "transactions"
COLL_ALERTS = "alerts"
COLL_CHART_OF_ACCOUNTS = "chartofaccounts"
COLL_JOURNAL_ENTRIES = "journalentries"
COLL_LANDED_COST = "landedcostliquidations"

EXCHANGE_RATE_CRC_PER_USD = 515.0


def load_mongo_uri() -> str:
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    load_dotenv(env_path)
    uri = os.getenv("MONGODB_URI")
    if not uri:
        print("ERROR: MONGODB_URI not found in .env.local", file=sys.stderr)
        sys.exit(1)
    return uri


def connect(uri: str) -> pymongo.database.Database:
    client = pymongo.MongoClient(uri)
    db_name = uri.split("/")[-1].split("?")[0]
    return client[db_name]


# ---------------------------------------------------------------------------
# Chart of Accounts
# ---------------------------------------------------------------------------
def seed_chart_of_accounts(db):
    accounts = [
        {"code": "1-1-01-01", "name": "Caja y Bancos", "type": "ASSET", "isActive": True},
        {"code": "1-1-03-01", "name": "Inventario de Mercancías", "type": "ASSET", "isActive": True},
        {"code": "1-1-05-01", "name": "Cuentas por Cobrar", "type": "ASSET", "isActive": True},
        {"code": "1-2-01-01", "name": "Equipo de Cómputo", "type": "ASSET", "isActive": True},
        {"code": "2-1-01-01", "name": "Cuentas por Pagar", "type": "LIABILITY", "isActive": True},
        {"code": "2-1-03-01", "name": "IVA por Pagar", "type": "LIABILITY", "isActive": True},
        {"code": "3-1-01-01", "name": "Capital Social", "type": "EQUITY", "isActive": True},
        {"code": "3-1-05-01", "name": "Utilidades Retenidas", "type": "EQUITY", "isActive": True},
        {"code": "4-1-01-01", "name": "Ventas de Mercancía", "type": "INCOME", "isActive": True},
        {"code": "5-1-01-01", "name": "Costo de Ventas", "type": "COST", "isActive": True},
        {"code": "5-1-02-01", "name": "Gastos Administrativos", "type": "EXPENSE", "isActive": True},
        {"code": "5-1-02-05", "name": "Gasto por Alquileres", "type": "EXPENSE", "isActive": True},
        {"code": "5-1-03-10", "name": "Gasto por Servicios Públicos", "type": "EXPENSE", "isActive": True},
        {"code": "5-1-04-01", "name": "Gasto por Fletes y Transportes", "type": "EXPENSE", "isActive": True},
        {"code": "5-1-99-01", "name": "Gastos No Deducibles", "type": "EXPENSE", "isActive": True},
    ]
    for acc in accounts:
        db[COLL_CHART_OF_ACCOUNTS].update_one(
            {"code": acc["code"]},
            {"$set": acc},
            upsert=True,
        )
    print(f"  ✓ {len(accounts)} accounts seeded")


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------
def seed_inventory(db):
    products = [
        {"sku": "AUR-001", "name": "Auricular Bluetooth Pro", "currentStock": 45, "purchasePrice": 8500, "landedCost": 8900, "salePrice": 15900},
        {"sku": "CBL-LTNG", "name": "Cable Lightning 1m", "currentStock": 120, "purchasePrice": 1800, "landedCost": 2100, "salePrice": 4900},
        {"sku": "CBL-USBC", "name": "Cable USB-C 1m", "currentStock": 200, "purchasePrice": 1500, "landedCost": 1700, "salePrice": 3900},
        {"sku": "CHGR-20W", "name": "Cargador Pared 20W USB-C", "currentStock": 60, "purchasePrice": 4200, "landedCost": 4600, "salePrice": 8900},
        {"sku": "CHGR-CAR", "name": "Cargador Vehicular 30W", "currentStock": 35, "purchasePrice": 3800, "landedCost": 4100, "salePrice": 7500},
        {"sku": "FND-GLS", "name": "Funda Vidrio Templado iPhone", "currentStock": 3, "purchasePrice": 950, "landedCost": 1100, "salePrice": 2900},
        {"sku": "HUB-4P", "name": "Hub USB-C 4 Puertos", "currentStock": 18, "purchasePrice": 6200, "landedCost": 6800, "salePrice": 12900},
        {"sku": "MSE-OPT", "name": "Mouse Óptico Inalámbrico", "currentStock": 40, "purchasePrice": 3500, "landedCost": 3800, "salePrice": 7900},
        {"sku": "PWR-BNK", "name": "Power Bank 10000mAh", "currentStock": 25, "purchasePrice": 7200, "landedCost": 7700, "salePrice": 14900},
        {"sku": "SPK-BT", "name": "Parlante Bluetooth Portátil", "currentStock": 12, "purchasePrice": 9500, "landedCost": 10200, "salePrice": 19900},
        {"sku": "SSD-1TB", "name": "Disco SSD Externo 1TB", "currentStock": 8, "purchasePrice": 28500, "landedCost": 30200, "salePrice": 54900},
        {"sku": "WH-1000X", "name": "Audífonos Cancelación Ruido", "currentStock": 0, "purchasePrice": 52000, "landedCost": 55000, "salePrice": 99900},
    ]
    for p in products:
        db[COLL_INVENTORY].update_one(
            {"sku": p["sku"]},
            {"$set": p},
            upsert=True,
        )
    print(f"  ✓ {len(products)} inventory items seeded")


# ---------------------------------------------------------------------------
# Transactions (Purchases & Sales)
# ---------------------------------------------------------------------------
def seed_transactions(db):
    today = datetime.utcnow()

    transactions = [
        {
            "type": "PURCHASE",
            "source": "XML",
            "documentType": "hacienda_xml",
            "origin": "national",
            "documentId": "50627042400012345678901234567890123456789012",
            "merchantName": "Distribuidora Tecnológica CR S.A.",
            "merchantTaxId": "3-101-123456",
            "currency": "CRC",
            "exchangeRate": 1.0,
            "items": [
                {"sku": "CBL-LTNG", "description": "Cable Lightning 1m", "quantity": 50, "unitPriceForeign": 1800, "discount": 0, "taxAmountForeign": 11700, "totalLineForeign": 90000},
                {"sku": "CBL-USBC", "description": "Cable USB-C 1m", "quantity": 80, "unitPriceForeign": 1500, "discount": 0, "taxAmountForeign": 15600, "totalLineForeign": 120000},
                {"sku": "CHGR-20W", "description": "Cargador Pared 20W USB-C", "quantity": 30, "unitPriceForeign": 4200, "discount": 0, "taxAmountForeign": 16380, "totalLineForeign": 126000},
            ],
            "subTotalForeign": 336000,
            "taxAmountForeign": 43680,
            "grandTotalForeign": 379680,
            "grandTotalCrc": 379680,
            "fiscalAnalysis": {
                "purchaseType": "product_purchase",
                "isDeductibleHacienda": True,
                "haciendaJustification": "Compra nacional de inventario para reventa.",
                "suggestedAccountCode": "1-1-03-01",
                "suggestedAccountName": "Inventario de Mercancías",
            },
            "createdAt": today - timedelta(days=7),
        },
        {
            "type": "PURCHASE",
            "source": "XML",
            "documentType": "foreign_invoice",
            "origin": "international",
            "documentId": "INV-2026-0421-US",
            "merchantName": "Shenzhen Electronics Co.",
            "merchantTaxId": "CN-91440300123456789X",
            "currency": "USD",
            "exchangeRate": EXCHANGE_RATE_CRC_PER_USD,
            "items": [
                {"sku": "AUR-001", "description": "Auricular Bluetooth Pro", "quantity": 60, "unitPriceForeign": 16.5, "discount": 0, "taxAmountForeign": 0, "totalLineForeign": 990.0},
                {"sku": "PWR-BNK", "description": "Power Bank 10000mAh", "quantity": 40, "unitPriceForeign": 14.0, "discount": 0, "taxAmountForeign": 0, "totalLineForeign": 560.0},
                {"sku": "SPK-BT", "description": "Parlante Bluetooth Portátil", "quantity": 25, "unitPriceForeign": 18.5, "discount": 0, "taxAmountForeign": 0, "totalLineForeign": 462.5},
                {"sku": "WH-1000X", "description": "Audífonos Cancelación Ruido", "quantity": 15, "unitPriceForeign": 101.0, "discount": 0, "taxAmountForeign": 0, "totalLineForeign": 1515.0},
            ],
            "subTotalForeign": 3527.5,
            "taxAmountForeign": 0,
            "grandTotalForeign": 3527.5,
            "grandTotalCrc": round(3527.5 * EXCHANGE_RATE_CRC_PER_USD),
            "fiscalAnalysis": {
                "purchaseType": "product_purchase",
                "isDeductibleHacienda": True,
                "haciendaJustification": "Importación de productos electrónicos para inventario.",
                "suggestedAccountCode": "1-1-03-01",
                "suggestedAccountName": "Inventario de Mercancías",
            },
            "createdAt": today - timedelta(days=5),
        },
        {
            "type": "SALE",
            "source": "OCR",
            "documentType": "pos_ticket",
            "origin": "national",
            "documentId": "TKT-20260426-001",
            "merchantName": "FacturaBot CR (Punto de Venta)",
            "merchantTaxId": "3-101-654321",
            "currency": "CRC",
            "exchangeRate": 1.0,
            "items": [
                {"sku": "AUR-001", "description": "Auricular Bluetooth Pro", "quantity": 2, "unitPriceForeign": 15900, "discount": 0, "taxAmountForeign": 4134, "totalLineForeign": 31800},
                {"sku": "CBL-USBC", "description": "Cable USB-C 1m", "quantity": 5, "unitPriceForeign": 3900, "discount": 0, "taxAmountForeign": 2535, "totalLineForeign": 19500},
                {"sku": "FND-GLS", "description": "Funda Vidrio Templado iPhone", "quantity": 3, "unitPriceForeign": 2900, "discount": 0, "taxAmountForeign": 1131, "totalLineForeign": 8700},
            ],
            "subTotalForeign": 60000,
            "taxAmountForeign": 7800,
            "grandTotalForeign": 67800,
            "grandTotalCrc": 67800,
            "createdAt": today - timedelta(days=1),
        },
        {
            "type": "SALE",
            "source": "XML",
            "documentType": "hacienda_xml",
            "origin": "national",
            "documentId": "50627042400098765432109876543210987654321098",
            "merchantName": "FacturaBot CR (Punto de Venta)",
            "merchantTaxId": "3-101-654321",
            "currency": "CRC",
            "exchangeRate": 1.0,
            "items": [
                {"sku": "SSD-1TB", "description": "Disco SSD Externo 1TB", "quantity": 1, "unitPriceForeign": 54900, "discount": 0, "taxAmountForeign": 7137, "totalLineForeign": 54900},
                {"sku": "HUB-4P", "description": "Hub USB-C 4 Puertos", "quantity": 2, "unitPriceForeign": 12900, "discount": 0, "taxAmountForeign": 3354, "totalLineForeign": 25800},
                {"sku": "MSE-OPT", "description": "Mouse Óptico Inalámbrico", "quantity": 1, "unitPriceForeign": 7900, "discount": 0, "taxAmountForeign": 1027, "totalLineForeign": 7900},
            ],
            "subTotalForeign": 88600,
            "taxAmountForeign": 11518,
            "grandTotalForeign": 100118,
            "grandTotalCrc": 100118,
            "createdAt": today - timedelta(hours=6),
        },
        {
            "type": "PURCHASE",
            "source": "MANUAL",
            "documentType": "national_pdf",
            "origin": "national",
            "documentId": "FAC-001-0001234",
            "merchantName": "Papelería y Suministros CR Ltda.",
            "merchantTaxId": "3-102-789012",
            "currency": "CRC",
            "exchangeRate": 1.0,
            "items": [
                {"sku": "FND-GLS", "description": "Funda Vidrio Templado iPhone", "quantity": 20, "unitPriceForeign": 950, "discount": 0, "taxAmountForeign": 2470, "totalLineForeign": 19000},
            ],
            "subTotalForeign": 19000,
            "taxAmountForeign": 2470,
            "grandTotalForeign": 21470,
            "grandTotalCrc": 21470,
            "fiscalAnalysis": {
                "purchaseType": "product_purchase",
                "isDeductibleHacienda": True,
                "haciendaJustification": "Compra local de accesorios para inventario.",
                "suggestedAccountCode": "1-1-03-01",
                "suggestedAccountName": "Inventario de Mercancías",
            },
            "createdAt": today - timedelta(hours=3),
        },
    ]

    for txn in transactions:
        txn["updatedAt"] = txn["createdAt"]
        db[COLL_TRANSACTIONS].update_one(
            {"documentId": txn["documentId"]},
            {"$set": txn},
            upsert=True,
        )
    print(f"  ✓ {len(transactions)} transactions seeded")


# ---------------------------------------------------------------------------
# Inventory sync: update stock to reflect seeded transactions
# ---------------------------------------------------------------------------
def sync_inventory_from_transactions(db):
    pipeline = [
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": "$items.sku",
                "name": {"$last": "$items.description"},
                "totalQty": {
                    "$sum": {
                        "$cond": [
                            {"$eq": ["$type", "PURCHASE"]},
                            "$items.quantity",
                            {"$multiply": ["$items.quantity", -1]},
                        ]
                    }
                },
            }
        },
    ]
    results = db[COLL_TRANSACTIONS].aggregate(pipeline)
    updated = 0
    for r in results:
        sku = r["_id"]
        if not sku:
            continue
        db[COLL_INVENTORY].update_one(
            {"sku": sku},
            {"$inc": {"currentStock": r["totalQty"]}},
        )
        updated += 1
    print(f"  ✓ {updated} inventory stock levels adjusted from transactions")


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------
def seed_alerts(db):
    alerts = [
        {
            "sku": "FND-GLS",
            "message": "Low stock alert for Funda Vidrio Templado iPhone (FND-GLS). Estimated 2 days remaining.",
            "isActive": True,
            "createdAt": datetime.utcnow() - timedelta(hours=2),
            "updatedAt": datetime.utcnow() - timedelta(hours=2),
        },
        {
            "sku": "WH-1000X",
            "message": "Low stock alert for Audífonos Cancelación Ruido (WH-1000X). Currently out of stock.",
            "isActive": True,
            "createdAt": datetime.utcnow() - timedelta(hours=1),
            "updatedAt": datetime.utcnow() - timedelta(hours=1),
        },
        {
            "sku": "SSD-1TB",
            "message": "Low stock alert for Disco SSD Externo 1TB (SSD-1TB). Estimated 3 days remaining.",
            "isActive": True,
            "createdAt": datetime.utcnow() - timedelta(minutes=30),
            "updatedAt": datetime.utcnow() - timedelta(minutes=30),
        },
    ]
    for a in alerts:
        db[COLL_ALERTS].update_one(
            {"sku": a["sku"], "isActive": True},
            {"$set": a},
            upsert=True,
        )
    print(f"  ✓ {len(alerts)} alerts seeded")


# ---------------------------------------------------------------------------
# Landed Cost Liquidations
# ---------------------------------------------------------------------------
def seed_landed_cost(db):
    foreign_txn = db[COLL_TRANSACTIONS].find_one({"documentId": "INV-2026-0421-US"})
    freight_txn = db[COLL_TRANSACTIONS].find_one({"documentId": "FAC-001-0001234"})
    if not foreign_txn:
        print("  ⚠ Skipping landed cost: foreign invoice transaction not found")
        return

    liquidation = {
        "foreignInvoiceId": foreign_txn["_id"],
        "associatedExpenses": [
            {
                "transactionId": freight_txn["_id"] if freight_txn else ObjectId(),
                "expenseType": "freight",
                "amountCrc": 85000,
            },
            {
                "transactionId": freight_txn["_id"] if freight_txn else ObjectId(),
                "expenseType": "customs_duty",
                "amountCrc": 125000,
            },
            {
                "transactionId": freight_txn["_id"] if freight_txn else ObjectId(),
                "expenseType": "handling",
                "amountCrc": 45000,
            },
        ],
        "totalExpensesCrc": 255000,
        "distributionMethod": "VALUE",
        "isApplied": False,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }
    db[COLL_LANDED_COST].update_one(
        {"foreignInvoiceId": foreign_txn["_id"]},
        {"$set": liquidation},
        upsert=True,
    )
    print("  ✓ 1 landed-cost liquidation seeded")


# ---------------------------------------------------------------------------
# Journal Entries
# ---------------------------------------------------------------------------
def seed_journal_entries(db):
    entries = [
        {
            "date": datetime.utcnow() - timedelta(days=7),
            "description": "Registro contable compra nacional Distribuidora Tecnológica",
            "lines": [
                {"accountCode": "1-1-03-01", "accountName": "Inventario de Mercancías", "type": "DEBIT", "amountCrc": 336000},
                {"accountCode": "2-1-03-01", "accountName": "IVA por Pagar", "type": "DEBIT", "amountCrc": 43680},
                {"accountCode": "2-1-01-01", "accountName": "Cuentas por Pagar", "type": "CREDIT", "amountCrc": 379680},
            ],
            "createdAt": datetime.utcnow() - timedelta(days=7),
            "updatedAt": datetime.utcnow() - timedelta(days=7),
        },
        {
            "date": datetime.utcnow() - timedelta(days=5),
            "description": "Registro contable importación Shenzhen Electronics",
            "lines": [
                {"accountCode": "1-1-03-01", "accountName": "Inventario de Mercancías", "type": "DEBIT", "amountCrc": 1816663},
                {"accountCode": "2-1-01-01", "accountName": "Cuentas por Pagar", "type": "CREDIT", "amountCrc": 1816663},
            ],
            "createdAt": datetime.utcnow() - timedelta(days=5),
            "updatedAt": datetime.utcnow() - timedelta(days=5),
        },
    ]
    for e in entries:
        db[COLL_JOURNAL_ENTRIES].insert_one(e)
    print(f"  ✓ {len(entries)} journal entries seeded")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Seed FacturaBot database with example data")
    parser.add_argument("--drop", action="store_true", help="Drop all collections before seeding")
    args = parser.parse_args()

    uri = load_mongo_uri()
    db = connect(uri)
    print(f"Connected to MongoDB: {db.name}")

    if args.drop:
        for name in [
            COLL_INVENTORY,
            COLL_TRANSACTIONS,
            COLL_ALERTS,
            COLL_CHART_OF_ACCOUNTS,
            COLL_JOURNAL_ENTRIES,
            COLL_LANDED_COST,
        ]:
            db[name].drop()
            print(f"  Dropped collection: {name}")

    print("\nSeeding chart of accounts...")
    seed_chart_of_accounts(db)

    print("Seeding inventory...")
    seed_inventory(db)

    print("Seeding transactions...")
    seed_transactions(db)
    sync_inventory_from_transactions(db)

    print("Seeding alerts...")
    seed_alerts(db)

    print("Seeding landed-cost liquidations...")
    seed_landed_cost(db)

    print("Seeding journal entries...")
    seed_journal_entries(db)

    print("\n✓ Database seeding complete!")
    print(f"  Database: {db.name}")


if __name__ == "__main__":
    main()
