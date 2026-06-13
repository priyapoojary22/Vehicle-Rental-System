-- ============================================================================
-- SQL SCHEMA FOR VEHICLE RENTAL SYSTEM (MySQL/PostgreSQL Standard)
-- ============================================================================

-- 1. Create Database
CREATE DATABASE VehicleRentalSystem;
USE VehicleRentalSystem;

-- 2. Create Tables
CREATE TABLE Customer (
    customer_id INT PRIMARY KEY,
    CustomerName VARCHAR(50) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    email VARCHAR(50) NOT NULL,
    LicenseNo VARCHAR(200) NOT NULL
);

CREATE TABLE Vehicle (
    VehicleID INT PRIMARY KEY,
    VehicleModel VARCHAR(50) NOT NULL,
    VehicleType VARCHAR(20) NOT NULL,
    RentalRate DECIMAL(10,2) NOT NULL,
    Status VARCHAR(20) DEFAULT 'Available',
    MaintenanceStatus VARCHAR(10) DEFAULT 'No'
);

CREATE TABLE Booking (
    BookingID INT PRIMARY KEY,
    CustomerID INT,
    VehicleID INT,
    BookingDate DATE,
    FOREIGN KEY (CustomerID) REFERENCES Customer(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (VehicleID) REFERENCES Vehicle(VehicleID) ON DELETE CASCADE
);

CREATE TABLE Rental (
    RentalID INT PRIMARY KEY,
    BookingID INT,
    StartDate DATE,
    EndDate DATE,
    TotalAmount DECIMAL(10,2),
    FOREIGN KEY (BookingID) REFERENCES Booking(BookingID) ON DELETE CASCADE
);

CREATE TABLE Payment (
    PaymentID INT PRIMARY KEY,
    RentalID INT,
    Amount DECIMAL(10,2),
    PaymentDate DATE,
    PaymentMethod VARCHAR(20),
    FOREIGN KEY (RentalID) REFERENCES Rental(RentalID) ON DELETE CASCADE
);

CREATE TABLE Maintenance (
    MaintenanceID INT PRIMARY KEY,
    VehicleID INT,
    MaintenanceDate DATE,
    Description VARCHAR(100),
    Cost DECIMAL(10,2),
    FOREIGN KEY (VehicleID) REFERENCES Vehicle(VehicleID) ON DELETE CASCADE
);

-- 3. Insert Seed Data
INSERT INTO Customer (customer_id, CustomerName, phone, email, LicenseNo) VALUES
(1,'Rahul Sharma','9876543210','rahul@gmail.com','DL1001'),
(2,'Priya Patel','9876543211','priya@gmail.com','DL1002'),
(3,'Amit Verma','9876543212','amit@gmail.com','DL1003'),
(4,'Sneha Rao','9876543213','sneha@gmail.com','DL1004'),
(5,'Karan Singh','9876543214','karan@gmail.com','DL1005');

INSERT INTO Vehicle (VehicleID, VehicleModel, VehicleType, RentalRate, Status, MaintenanceStatus) VALUES
(101,'Hyundai Creta','SUV',2500,'Available','No'),
(102,'Honda City','Sedan',2200,'Available','No'),
(103,'Toyota Innova','MPV',3500,'Available','Yes'), -- Set to Yes for Trigger Showcase
(104,'Royal Enfield 350','Bike',1000,'Available','No'),
(105,'Mahindra Thar','SUV',4000,'Available','No'),
(106,'Kia Seltos','SUV',2700,'Available','No');

INSERT INTO Booking (BookingID, CustomerID, VehicleID, BookingDate) VALUES
(201,1,101,'2025-06-01'),
(202,2,101,'2025-06-02'),
(203,3,101,'2025-06-03'),
(204,4,101,'2025-06-04'),
(205,5,101,'2025-06-05'),
(206,1,101,'2025-06-06'),
(207,2,101,'2025-06-07'),
(208,3,101,'2025-06-08'),
(209,4,105,'2025-06-09'),
(210,5,105,'2025-06-10'),
(211,1,105,'2025-06-11'),
(212,2,105,'2025-06-12'),
(213,3,105,'2025-06-13'),
(214,4,105,'2025-06-14'),
(215,5,105,'2025-06-15'),
(216,1,105,'2025-06-16'),
(217,2,102,'2025-06-17'),
(218,3,102,'2025-06-18'),
(219,4,102,'2025-06-19'),
(220,5,103,'2025-06-20'),
(221,1,103,'2025-06-21'),
(222,2,104,'2025-06-22'),
(223,3,104,'2025-06-23');

INSERT INTO Rental (RentalID, BookingID, StartDate, EndDate, TotalAmount) VALUES
(301,201,'2025-06-01','2025-06-05',10000),
(302,202,'2025-06-02','2025-06-04',4400),
(303,203,'2025-06-03','2025-06-08',17500),
(304,204,'2025-06-04','2025-06-06',2000),
(305,205,'2025-06-05','2025-06-10',20000);

INSERT INTO Payment (PaymentID, RentalID, Amount, PaymentDate, PaymentMethod) VALUES
(401,301,10000,'2025-06-05','UPI'),
(402,302,4400,'2025-06-04','Card'),
(403,303,17500,'2025-06-08','Cash'),
(404,304,2000,'2025-06-06','UPI'),
(405,305,20000,'2025-06-10','Card');

INSERT INTO Maintenance (MaintenanceID, VehicleID, MaintenanceDate, Description, Cost) VALUES
(501,101,'2025-05-01','Engine Service',5000),
(502,102,'2025-05-02','Oil Change',1500),
(503,103,'2025-05-03','Brake Repair',3000),
(504,104,'2025-05-04','Tyre Change',2500),
(505,105,'2025-05-05','Battery Replacement',4000);


-- ============================================================================
-- 4. Stored Procedures (PostgreSQL / MySQL Standard Syntax)
-- ============================================================================

-- 1. CalculateRentalCharge Procedure
-- DELIMITER //
-- CREATE PROCEDURE CalculateRentalCharge(
--     IN p_VehicleID INT,
--     IN p_Days INT
-- )
-- BEGIN
--     DECLARE v_RentalRate DECIMAL(10,2);
--     SELECT RentalRate INTO v_RentalRate FROM Vehicle WHERE VehicleID = p_VehicleID;
--     SELECT
--         VehicleID,
--         VehicleModel,
--         RentalRate,
--         p_Days AS NumberOfDays,
--         (RentalRate * p_Days) AS TotalRentalCharge
--     FROM Vehicle
--     WHERE VehicleID = p_VehicleID;
-- END //
-- DELIMITER ;

-- 2. VehicleAvailabilityReport Procedure
-- DELIMITER //
-- CREATE PROCEDURE VehicleAvailabilityReport()
-- BEGIN
--     SELECT
--         VehicleID,
--         VehicleModel,
--         VehicleType,
--         RentalRate,
--         Status
--     FROM Vehicle
--     ORDER BY VehicleID;
-- END //
-- DELIMITER ;


-- ============================================================================
-- 5. Triggers (MySQL Standard Syntax)
-- ============================================================================

-- 1. Trigger to update vehicle status after booking
-- DELIMITER //
-- CREATE TRIGGER trg_update_vehicle_status
-- AFTER INSERT ON Booking
-- FOR EACH ROW
-- BEGIN
--     UPDATE Vehicle
--     SET Status = 'Rented'
--     WHERE VehicleID = NEW.VehicleID;
-- END //
-- DELIMITER ;

-- 2. Trigger to prevent booking if vehicle is under maintenance
-- DELIMITER //
-- CREATE TRIGGER trg_prevent_booking
-- BEFORE INSERT ON Booking
-- FOR EACH ROW
-- BEGIN
--     DECLARE v_status VARCHAR(20);
--     SELECT MaintenanceStatus INTO v_status FROM Vehicle WHERE VehicleID = NEW.VehicleID;
--     IF v_status = 'Yes' THEN
--         SIGNAL SQLSTATE '45000'
--         SET MESSAGE_TEXT = 'Booking not allowed. Vehicle is under maintenance.';
--     END IF;
-- END //
-- DELIMITER ;
