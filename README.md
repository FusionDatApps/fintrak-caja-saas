# Fintrak Caja (MVP)

## Objetivo
SaaS para control de caja de negocios pequeños.
Permite registrar ingresos, egresos, categorías, ver resumen mensual y exportar datos.

## Pantallas
- /login
- /register
- /dashboard
- /transactions

## Entidades
- User
- Category
- Transaction

## Campos Transaction
type: income|expense
amount: numeric
category_id
date: YYYY-MM-DD
description
counterparty (optional)
payment_method: cash|bank|card|transfer
status: paid|pending