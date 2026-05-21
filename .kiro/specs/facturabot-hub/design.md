# Design Document: FacturaBot Hub

## Overview

FacturaBot Hub is an autonomous retail operations engine for Costa Rican businesses built as a single Next.js 16+ (App Router) application. It ingests electronic invoices (Hacienda XML, receipt images via OCR, and Telegram messages), maintains a live inventory and transaction ledger in MongoDB Atlas, and surfaces business intelligence through a Gemini-powered chat interface and a responsive dashboard.

The system has three ingestion channels (XML API, Image/OCR API, Telegram webhook), one AI reasoning layer (Gemini Function Calling chat), one analytics engine (`checkInventoryHealth`), and one unified dashboard UI. All channels converge on the same MongoDB collections, ensuring a single source of truth for inventory, transactions, and alerts.

Next.js 16 App Router conventions apply throughout: route handlers use the Web `Request`/`Response` APIs (not `NextRequest`/`NextResponse` unless extended features are needed), `params` and `searchParams` are Promises, and the dashboard page is a Client Component (`'use client'`) because it requires state, event handlers, and browser APIs (drag-and-drop, file input).

---

## Architecture

```mermaid
graph TD
    subgraph Ingestion["Ingestion Channels"]
        XML["POST /api/factura/xml<br/>(Hacienda XML)"]
        IMG["POST /api/factura/image<br/>(Receipt OCR)"]
        TG["POST /api/telegram<br/>(Telegraf Webhook)"]
    end

    subgraph AI["AI Layer"]
        CHAT["POST /api/chat<br/>(Gemini Function Calling)"]
        GEMINI["Gemini 1.5 Flash"]
        OCR_ENGINE["Tesseract.js (Spanish)"]
    end

    subgraph Data["Data Layer"]
        DB["MongoDB Atlas<br/>(Mongoose v9)"]
        INV["Inventory Collection"]
        TXN["Transaction Collection"]
        ALT["Alert Collection"]
    end

    subgraph Analytics["Analytics Engine"]
        HEALTH["checkInventoryHealth()<br/>lib/analytics.ts"]
    end

    subgraph UI["Dashboard UI"]
        DASH["app/page.tsx<br/>(Client Component)"]
    end

    XML -->|"parse + upsert"| INV
    XML -->|"create"| TXN
    IMG -->|"OCR text"| OCR_ENGINE
    OCR_ENGINE -->|"raw text"| GEMINI
    GEMINI -->|"structured JSON"| TXN
    TG -->|"forward to"| XML
    TG -->|"forward to"| IMG
    TG -->|"forward to"| CHAT
    CHAT -->|"function calls"| DB
    CHAT -->|"generate"| GEMINI
    DB --- INV
    DB --- TXN
    DB --- ALT
    HEALTH -->|"reads"| INV
    HEALTH -->|"reads"| TXN
    HEALTH -->|"writes"| ALT
    DASH -->|"fetch GET /api/dashboard/stats"| DB
    DASH -->|"POST /api/factura/xml or image"| XML
    DASH -->|"POST /api/chat"| CHAT
```
