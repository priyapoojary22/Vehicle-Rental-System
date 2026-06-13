# 🚗 Vehicle Rental System (DBMS Project)

## 📌 Project Overview
The **Vehicle Rental System** is a database management system project designed to manage vehicle bookings, rentals, payments, and maintenance efficiently. It demonstrates core DBMS concepts like tables, joins, subqueries, stored procedures, and triggers using SQL.

## 🛠️ Technologies Used
- MySQL / SQL
- DBMS Concepts
- Stored Procedures
- Triggers
- SQL Queries (JOIN, GROUP BY, HAVING, Subqueries)


## 🗄️ Database Name
VehicleRentalSystem

## 📊 Tables Used

### Customer
Stores customer details like name, phone, and license number.

### Vehicle
Stores vehicle information including model, type, rental rate, and status.

### Booking
Stores booking records linking customers and vehicles.

### Rental
Stores rental duration and total amount.

### Payment
Stores payment details for each rental.

### Maintenance
Stores vehicle maintenance records.



## 🔗 Relationships
- Customer → Booking → Rental
- Vehicle → Booking
- Rental → Payment
- Vehicle → Maintenance



## ⚙️ Features

### Basic Operations
- Create and manage customers, vehicles, bookings, rentals, and payments
- View and analyze data using SQL queries

### SQL Concepts Used
- INNER JOIN
- LEFT JOIN
- GROUP BY & HAVING
- Subqueries
- Correlated Subqueries
- NOT EXISTS


## 🧠 Advanced Features

### Stored Procedures
- Calculate rental charges based on number of days
- Generate vehicle availability report

### Triggers
- Automatically update vehicle status after booking
- Prevent booking if vehicle is under maintenance


## ▶️ How to Run the Project

1. Open MySQL Workbench or any SQL editor
2. Create database:
   ```sql
   CREATE DATABASE VehicleRentalSystem;
   USE VehicleRentalSystem;
