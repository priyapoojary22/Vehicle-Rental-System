const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Mode Configuration
let dbMode = 'sqlite'; // Default mode, toggled to 'mysql' if MySQL connects successfully.
let mysqlPool = null;
let sqliteDb = null;

// MySQL Config parameters
const mysqlConfig = {
  host: 'localhost',
  user: 'root',
  password: '1289',
  port: 3306,
  multipleStatements: true
};

// Database File Path for SQLite Fallback
const dbPath = path.join(__dirname, 'db', 'database.sqlite');

// Query logs cache
const sqlLogs = [];

function logSQL(sql, params = [], context = '') {
  let formattedSQL = sql;
  if (params && params.length > 0) {
    params.forEach(param => {
      const val = typeof param === 'string' ? `'${param.replace(/'/g, "''")}'` : param;
      formattedSQL = formattedSQL.replace('?', val);
    });
  }
  
  const logEntry = {
    id: Date.now() + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toLocaleTimeString(),
    sql: formattedSQL,
    context: `${dbMode.toUpperCase()} | ${context}`
  };
  sqlLogs.push(logEntry);
  if (sqlLogs.length > 100) sqlLogs.shift();
  console.log(`[SQL Log] [${dbMode.toUpperCase()}] ${context}: ${formattedSQL}`);
}

// ============================================================================
// DATABASE CONNECTION & WRAPPERS
// ============================================================================

async function dbRun(sql, params = [], context = '') {
  logSQL(sql, params, context);
  if (dbMode === 'mysql') {
    const [result] = await mysqlPool.query(sql, params);
    return { lastID: result.insertId, changes: result.affectedRows };
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
}

async function dbGet(sql, params = [], context = '') {
  logSQL(sql, params, context);
  if (dbMode === 'mysql') {
    const [rows] = await mysqlPool.query(sql, params);
    return rows[0];
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
}

async function dbAll(sql, params = [], context = '') {
  logSQL(sql, params, context);
  if (dbMode === 'mysql') {
    const [rows] = await mysqlPool.query(sql, params);
    return rows;
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

// Establish DB connection
async function startDatabase() {
  try {
    // 1. Try MySQL Connection
    console.log('Attempting connection to local MySQL server (root/1289)...');
    const conn = await mysql.createConnection({
      host: mysqlConfig.host,
      user: mysqlConfig.user,
      password: mysqlConfig.password,
      port: mysqlConfig.port
    });
    
    await conn.query('CREATE DATABASE IF NOT EXISTS VehicleRentalSystem;');
    await conn.end();

    mysqlPool = mysql.createPool({
      ...mysqlConfig,
      database: 'VehicleRentalSystem'
    });

    dbMode = 'mysql';
    console.log('Successfully connected to MySQL database: VehicleRentalSystem');
  } catch (err) {
    console.warn('MySQL Connection failed. Reverting to SQLite database mode. Error:', err.message);
    dbMode = 'sqlite';
    
    // Initialize SQLite connection
    sqliteDb = new sqlite3.Database(dbPath, (err) => {
      if (err) console.error('SQLite initialization failed:', err.message);
      else console.log('Successfully connected to fallback SQLite database.');
    });
  }

  await initializeDatabase();
}

// Database Initialization (Schema Creation & Seeding)
async function initializeDatabase() {
  if (dbMode === 'mysql') {
    await initializeMySQL();
  } else {
    await initializeSQLite();
  }
}

// MySQL Setup script
async function initializeMySQL() {
  try {
    console.log('Initializing MySQL Tables and Seeds...');
    
    // Drops
    await mysqlPool.query('DROP TRIGGER IF EXISTS trg_update_vehicle_status');
    await mysqlPool.query('DROP TRIGGER IF EXISTS trg_prevent_booking');
    await mysqlPool.query('DROP PROCEDURE IF EXISTS CalculateRentalCharge');
    await mysqlPool.query('DROP PROCEDURE IF EXISTS VehicleAvailabilityReport');
    await mysqlPool.query('DROP TABLE IF EXISTS Maintenance');
    await mysqlPool.query('DROP TABLE IF EXISTS Payment');
    await mysqlPool.query('DROP TABLE IF EXISTS Rental');
    await mysqlPool.query('DROP TABLE IF EXISTS Booking');
    await mysqlPool.query('DROP TABLE IF EXISTS Vehicle');
    await mysqlPool.query('DROP TABLE IF EXISTS Customer');

    // Create Tables
    await mysqlPool.query(`
      CREATE TABLE Customer (
        customer_id INT PRIMARY KEY,
        CustomerName VARCHAR(50) NOT NULL,
        phone VARCHAR(15) NOT NULL,
        email VARCHAR(50) NOT NULL,
        LicenseNo VARCHAR(200) NOT NULL
      )
    `);

    await mysqlPool.query(`
      CREATE TABLE Vehicle (
        VehicleID INT PRIMARY KEY,
        VehicleModel VARCHAR(50) NOT NULL,
        VehicleType VARCHAR(20) NOT NULL,
        RentalRate DECIMAL(10,2) NOT NULL,
        Status VARCHAR(20) DEFAULT 'Available',
        MaintenanceStatus VARCHAR(10) DEFAULT 'No'
      )
    `);

    await mysqlPool.query(`
      CREATE TABLE Booking (
        BookingID INT PRIMARY KEY,
        CustomerID INT,
        VehicleID INT,
        BookingDate DATE,
        FOREIGN KEY (CustomerID) REFERENCES Customer(customer_id) ON DELETE CASCADE,
        FOREIGN KEY (VehicleID) REFERENCES Vehicle(VehicleID) ON DELETE CASCADE
      )
    `);

    await mysqlPool.query(`
      CREATE TABLE Rental (
        RentalID INT PRIMARY KEY,
        BookingID INT,
        StartDate DATE,
        EndDate DATE,
        TotalAmount DECIMAL(10,2),
        FOREIGN KEY (BookingID) REFERENCES Booking(BookingID) ON DELETE CASCADE
      )
    `);

    await mysqlPool.query(`
      CREATE TABLE Payment (
        PaymentID INT PRIMARY KEY,
        RentalID INT,
        Amount DECIMAL(10,2),
        PaymentDate DATE,
        PaymentMethod VARCHAR(20),
        FOREIGN KEY (RentalID) REFERENCES Rental(RentalID) ON DELETE CASCADE
      )
    `);

    await mysqlPool.query(`
      CREATE TABLE Maintenance (
        MaintenanceID INT PRIMARY KEY,
        VehicleID INT,
        MaintenanceDate DATE,
        Description VARCHAR(100),
        Cost DECIMAL(10,2),
        FOREIGN KEY (VehicleID) REFERENCES Vehicle(VehicleID) ON DELETE CASCADE
      )
    `);

    // Create Triggers
    await mysqlPool.query(`
      CREATE TRIGGER trg_update_vehicle_status
      AFTER INSERT ON Booking
      FOR EACH ROW
      BEGIN
          UPDATE Vehicle SET Status = 'Rented' WHERE VehicleID = NEW.VehicleID;
      END
    `);

    await mysqlPool.query(`
      CREATE TRIGGER trg_prevent_booking
      BEFORE INSERT ON Booking
      FOR EACH ROW
      BEGIN
          DECLARE v_status VARCHAR(20);
          SELECT MaintenanceStatus INTO v_status FROM Vehicle WHERE VehicleID = NEW.VehicleID;
          IF v_status = 'Yes' THEN
              SIGNAL SQLSTATE '45000'
              SET MESSAGE_TEXT = 'Booking not allowed. Vehicle is under maintenance.';
          END IF;
      END
    `);

    // Create Stored Procedures
    await mysqlPool.query(`
      CREATE PROCEDURE CalculateRentalCharge(
          IN p_VehicleID INT,
          IN p_Days INT
      )
      BEGIN
          DECLARE v_RentalRate DECIMAL(10,2);
          SELECT RentalRate INTO v_RentalRate FROM Vehicle WHERE VehicleID = p_VehicleID;
          SELECT
              VehicleID,
              VehicleModel,
              RentalRate,
              p_Days AS NumberOfDays,
              (RentalRate * p_Days) AS TotalRentalCharge
          FROM Vehicle
          WHERE VehicleID = p_VehicleID;
      END
    `);

    await mysqlPool.query(`
      CREATE PROCEDURE VehicleAvailabilityReport()
      BEGIN
          SELECT
              VehicleID,
              VehicleModel,
              VehicleType,
              RentalRate,
              Status
          FROM Vehicle
          ORDER BY VehicleID;
      END
    `);

    // Seeds
    const customers = [
      [1,'Rahul Sharma','9876543210','rahul@gmail.com','DL1001'],
      [2,'Priya Patel','9876543211','priya@gmail.com','DL1002'],
      [3,'Amit Verma','9876543212','amit@gmail.com','DL1003'],
      [4,'Sneha Rao','9876543213','sneha@gmail.com','DL1004'],
      [5,'Karan Singh','9876543214','karan@gmail.com','DL1005']
    ];
    for (const c of customers) {
      await mysqlPool.query('INSERT INTO Customer VALUES (?, ?, ?, ?, ?)', c);
    }

    const vehicles = [
      [101,'Hyundai Creta','SUV',2500,'Available','No'],
      [102,'Honda City','Sedan',2200,'Available','No'],
      [103,'Toyota Innova','MPV',3500,'Available','Yes'], // Set to Yes for Trigger 2 Showcase
      [104,'Royal Enfield 350','Bike',1000,'Available','No'],
      [105,'Mahindra Thar','SUV',4000,'Available','No'],
      [106,'Kia Seltos','SUV',2700,'Available','No']
    ];
    for (const v of vehicles) {
      await mysqlPool.query('INSERT INTO Vehicle VALUES (?, ?, ?, ?, ?, ?)', v);
    }

    const bookings = [
      [201,1,101,'2025-06-01'],[202,2,101,'2025-06-02'],[203,3,101,'2025-06-03'],[204,4,101,'2025-06-04'],
      [205,5,101,'2025-06-05'],[206,1,101,'2025-06-06'],[207,2,101,'2025-06-07'],[208,3,101,'2025-06-08'],
      [209,4,105,'2025-06-09'],[210,5,105,'2025-06-10'],[211,1,105,'2025-06-11'],[212,2,105,'2025-06-12'],
      [213,3,105,'2025-06-13'],[214,4,105,'2025-06-14'],[215,5,105,'2025-06-15'],[216,1,105,'2025-06-16'],
      [217,2,102,'2025-06-17'],[218,3,102,'2025-06-18'],[219,4,102,'2025-06-19'],[220,5,103,'2025-06-20'],
      [221,1,103,'2025-06-21'],[222,2,104,'2025-06-22'],[223,3,104,'2025-06-23']
    ];
    // Disable prevent trigger temporarily to seed booking 220 & 221 on vehicle 103
    await mysqlPool.query("UPDATE Vehicle SET MaintenanceStatus = 'No' WHERE VehicleID = 103");
    for (const b of bookings) {
      await mysqlPool.query('INSERT INTO Booking VALUES (?, ?, ?, ?)', b);
    }
    await mysqlPool.query("UPDATE Vehicle SET MaintenanceStatus = 'Yes' WHERE VehicleID = 103");
    await mysqlPool.query("UPDATE Vehicle SET Status = 'Rented' WHERE VehicleID IN (101, 102, 103, 104, 105)");

    const rentals = [
      [301,201,'2025-06-01','2025-06-05',10000],
      [302,202,'2025-06-02','2025-06-04',4400],
      [303,203,'2025-06-03','2025-06-08',17500],
      [304,204,'2025-06-04','2025-06-06',2000],
      [305,205,'2025-06-05','2025-06-10',20000]
    ];
    for (const r of rentals) {
      await mysqlPool.query('INSERT INTO Rental VALUES (?, ?, ?, ?, ?)', r);
    }

    const payments = [
      [401,301,10000,'2025-06-05','UPI'],
      [402,302,4400,'2025-06-04','Card'],
      [403,303,17500,'2025-06-08','Cash'],
      [404,304,2000,'2025-06-06','UPI'],
      [405,305,20000,'2025-06-10','Card']
    ];
    for (const p of payments) {
      await mysqlPool.query('INSERT INTO Payment VALUES (?, ?, ?, ?, ?)', p);
    }

    const maintenance = [
      [501,101,'2025-05-01','Engine Service',5000],
      [502,102,'2025-05-02','Oil Change',1500],
      [503,103,'2025-05-03','Brake Repair',3000],
      [504,104,'2025-05-04','Tyre Change',2500],
      [505,105,'2025-05-05','Battery Replacement',4000]
    ];
    for (const m of maintenance) {
      await mysqlPool.query('INSERT INTO Maintenance VALUES (?, ?, ?, ?, ?)', m);
    }

    console.log('MySQL Database populated successfully.');
  } catch (err) {
    console.error('MySQL seeding error:', err);
  }
}

// SQLite setup script (fallback)
async function initializeSQLite() {
  try {
    console.log('Initializing SQLite fallback tables and seeds...');
    await dbRun("DROP TRIGGER IF EXISTS trg_update_vehicle_status");
    await dbRun("DROP TRIGGER IF EXISTS trg_prevent_booking");
    await dbRun("DROP TABLE IF EXISTS Maintenance");
    await dbRun("DROP TABLE IF EXISTS Payment");
    await dbRun("DROP TABLE IF EXISTS Rental");
    await dbRun("DROP TABLE IF EXISTS Booking");
    await dbRun("DROP TABLE IF EXISTS Vehicle");
    await dbRun("DROP TABLE IF EXISTS Customer");

    await dbRun(`
      CREATE TABLE Customer (
        customer_id INTEGER PRIMARY KEY,
        CustomerName TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        LicenseNo TEXT NOT NULL
      )
    `, [], 'Create Customer Table');

    await dbRun(`
      CREATE TABLE Vehicle (
        VehicleID INTEGER PRIMARY KEY,
        VehicleModel TEXT NOT NULL,
        VehicleType TEXT NOT NULL,
        RentalRate DECIMAL(10,2) NOT NULL,
        Status TEXT DEFAULT 'Available',
        MaintenanceStatus TEXT DEFAULT 'No'
      )
    `, [], 'Create Vehicle Table');

    await dbRun(`
      CREATE TABLE Booking (
        BookingID INTEGER PRIMARY KEY,
        CustomerID INTEGER,
        VehicleID INTEGER,
        BookingDate TEXT,
        FOREIGN KEY (CustomerID) REFERENCES Customer(customer_id) ON DELETE CASCADE,
        FOREIGN KEY (VehicleID) REFERENCES Vehicle(VehicleID) ON DELETE CASCADE
      )
    `, [], 'Create Booking Table');

    await dbRun(`
      CREATE TABLE Rental (
        RentalID INTEGER PRIMARY KEY,
        BookingID INTEGER,
        StartDate TEXT,
        EndDate TEXT,
        TotalAmount DECIMAL(10,2),
        FOREIGN KEY (BookingID) REFERENCES Booking(BookingID) ON DELETE CASCADE
      )
    `, [], 'Create Rental Table');

    await dbRun(`
      CREATE TABLE Payment (
        PaymentID INTEGER PRIMARY KEY,
        RentalID INTEGER,
        Amount DECIMAL(10,2),
        PaymentDate TEXT,
        PaymentMethod TEXT,
        FOREIGN KEY (RentalID) REFERENCES Rental(RentalID) ON DELETE CASCADE
      )
    `, [], 'Create Payment Table');

    await dbRun(`
      CREATE TABLE Maintenance (
        MaintenanceID INTEGER PRIMARY KEY,
        VehicleID INTEGER,
        MaintenanceDate TEXT,
        Description TEXT,
        Cost DECIMAL(10,2),
        FOREIGN KEY (VehicleID) REFERENCES Vehicle(VehicleID) ON DELETE CASCADE
      )
    `, [], 'Create Maintenance Table');

    await dbRun(`
      CREATE TRIGGER trg_update_vehicle_status
      AFTER INSERT ON Booking
      BEGIN
        UPDATE Vehicle SET Status = 'Rented' WHERE VehicleID = NEW.VehicleID;
      END
    `, [], 'Create Trigger trg_update_vehicle_status');

    await dbRun(`
      CREATE TRIGGER trg_prevent_booking
      BEFORE INSERT ON Booking
      BEGIN
        SELECT RAISE(FAIL, 'Booking not allowed. Vehicle is under maintenance.')
        FROM Vehicle
        WHERE VehicleID = NEW.VehicleID AND MaintenanceStatus = 'Yes';
      END
    `, [], 'Create Trigger trg_prevent_booking');

    const customerSeeds = [
      [1,'Rahul Sharma','9876543210','rahul@gmail.com','DL1001'],
      [2,'Priya Patel','9876543211','priya@gmail.com','DL1002'],
      [3,'Amit Verma','9876543212','amit@gmail.com','DL1003'],
      [4,'Sneha Rao','9876543213','sneha@gmail.com','DL1004'],
      [5,'Karan Singh','9876543214','karan@gmail.com','DL1005']
    ];
    for (const row of customerSeeds) {
      await dbRun('INSERT INTO Customer VALUES (?, ?, ?, ?, ?)', row, 'Seed Customer');
    }

    const vehicleSeeds = [
      [101,'Hyundai Creta','SUV',2500,'Available','No'],
      [102,'Honda City','Sedan',2200,'Available','No'],
      [103,'Toyota Innova','MPV',3500,'Available','Yes'],
      [104,'Royal Enfield 350','Bike',1000,'Available','No'],
      [105,'Mahindra Thar','SUV',4000,'Available','No'],
      [106,'Kia Seltos','SUV',2700,'Available','No']
    ];
    for (const row of vehicleSeeds) {
      await dbRun('INSERT INTO Vehicle VALUES (?, ?, ?, ?, ?, ?)', row, 'Seed Vehicle');
    }

    const bookingSeeds = [
      [201,1,101,'2025-06-01'],[202,2,101,'2025-06-02'],[203,3,101,'2025-06-03'],[204,4,101,'2025-06-04'],
      [205,5,101,'2025-06-05'],[206,1,101,'2025-06-06'],[207,2,101,'2025-06-07'],[208,3,101,'2025-06-08'],
      [209,4,105,'2025-06-09'],[210,5,105,'2025-06-10'],[211,1,105,'2025-06-11'],[212,2,105,'2025-06-12'],
      [213,3,105,'2025-06-13'],[214,4,105,'2025-06-14'],[215,5,105,'2025-06-15'],[216,1,105,'2025-06-16'],
      [217,2,102,'2025-06-17'],[218,3,102,'2025-06-18'],[219,4,102,'2025-06-19'],[220,5,103,'2025-06-20'],
      [221,1,103,'2025-06-21'],[222,2,104,'2025-06-22'],[223,3,104,'2025-06-23']
    ];
    await dbRun("UPDATE Vehicle SET MaintenanceStatus = 'No' WHERE VehicleID = 103");
    for (const row of bookingSeeds) {
      await dbRun('INSERT INTO Booking VALUES (?, ?, ?, ?)', row, 'Seed Booking');
    }
    await dbRun("UPDATE Vehicle SET MaintenanceStatus = 'Yes' WHERE VehicleID = 103");
    await dbRun("UPDATE Vehicle SET Status = 'Rented' WHERE VehicleID IN (101, 102, 103, 104, 105)");

    const rentalSeeds = [
      [301,201,'2025-06-01','2025-06-05',10000],
      [302,202,'2025-06-02','2025-06-04',4400],
      [303,203,'2025-06-03','2025-06-08',17500],
      [304,204,'2025-06-04','2025-06-06',2000],
      [305,205,'2025-06-05','2025-06-10',20000]
    ];
    for (const row of rentalSeeds) {
      await dbRun('INSERT INTO Rental VALUES (?, ?, ?, ?, ?)', row, 'Seed Rental');
    }

    const paymentSeeds = [
      [401,301,10000,'2025-06-05','UPI'],
      [402,302,4400,'2025-06-04','Card'],
      [403,303,17500,'2025-06-08','Cash'],
      [404,304,2000,'2025-06-06','UPI'],
      [405,305,20000,'2025-06-10','Card']
    ];
    for (const row of paymentSeeds) {
      await dbRun('INSERT INTO Payment VALUES (?, ?, ?, ?, ?)', row, 'Seed Payment');
    }

    const maintenanceSeeds = [
      [501,101,'2025-05-01','Engine Service',5000],
      [502,102,'2025-05-02','Oil Change',1500],
      [503,103,'2025-05-03','Brake Repair',3000],
      [504,104,'2025-05-04','Tyre Change',2500],
      [505,105,'2025-05-05','Battery Replacement',4000]
    ];
    for (const row of maintenanceSeeds) {
      await dbRun('INSERT INTO Maintenance VALUES (?, ?, ?, ?, ?)', row, 'Seed Maintenance');
    }
    console.log('SQLite fallback seeded successfully.');
  } catch (err) {
    console.error('SQLite initialization failed', err);
  }
}

// ============================================================================
// API CONTROLLERS
// ============================================================================

app.get('/api/sql-logs', (req, res) => {
  res.json(sqlLogs);
});
app.post('/api/sql-logs/clear', (req, res) => {
  sqlLogs.length = 0;
  res.json({ message: 'Logs cleared.' });
});

app.post('/api/sql-logs/query', async (req, res) => {
  const { sql } = req.body;
  if (!sql) return res.status(400).json({ error: 'SQL query string required.' });
  try {
    const rows = await dbAll(sql, [], 'Custom Query');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const custs = await dbGet('SELECT COUNT(*) as count FROM Customer', [], 'Dashboard Metric: Customers');
    const vehs = await dbGet('SELECT COUNT(*) as count FROM Vehicle', [], 'Dashboard Metric: Vehicles');
    const avail = await dbGet("SELECT COUNT(*) as count FROM Vehicle WHERE Status = 'Available'", [], 'Dashboard Metric: Available Vehicles');
    const active = await dbGet("SELECT COUNT(*) as count FROM Booking", [], 'Dashboard Metric: Bookings');
    const completed = await dbGet("SELECT COUNT(*) as count FROM Rental", [], 'Dashboard Metric: Rentals');
    const rev = await dbGet("SELECT SUM(Amount) as sum FROM Payment", [], 'Dashboard Metric: Payments');

    // Dialect specific date group queries
    const formatQuery = dbMode === 'mysql'
      ? "SELECT DATE_FORMAT(PaymentDate, '%Y-%m') as month, SUM(Amount) as total FROM Payment GROUP BY month ORDER BY month DESC LIMIT 6"
      : "SELECT strftime('%Y-%m', PaymentDate) as month, SUM(Amount) as total FROM Payment GROUP BY month ORDER BY month DESC LIMIT 6";

    const revHistory = await dbAll(formatQuery, [], 'Dashboard: Revenue Analytics');

    const vehComposition = await dbAll(`
      SELECT VehicleType as type, COUNT(*) as count
      FROM Vehicle
      GROUP BY type
    `, [], 'Dashboard: Vehicle Composition');

    res.json({
      totalCustomers: custs.count,
      totalVehicles: vehs.count,
      availableVehicles: avail.count,
      activeRentals: active.count,
      completedRentals: completed.count,
      totalRevenue: rev.sum || 0,
      revenueHistory: revHistory.reverse(),
      vehicleTypeDistribution: vehComposition
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customers CRUD
app.get('/api/customers', async (req, res) => {
  const { search } = req.query;
  let q = 'SELECT * FROM Customer';
  const params = [];
  if (search) {
    q += ' WHERE CustomerName LIKE ? OR phone LIKE ? OR email LIKE ?';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  q += ' ORDER BY customer_id DESC';
  try {
    const rows = await dbAll(q, params, 'View Customer Directory');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers', async (req, res) => {
  const { CustomerName, phone, email, LicenseNo } = req.body;
  try {
    const maxId = await dbGet('SELECT MAX(customer_id) as maxVal FROM Customer');
    const nextId = (maxId.maxVal || 0) + 1;
    await dbRun(
      'INSERT INTO Customer VALUES (?, ?, ?, ?, ?)',
      [nextId, CustomerName, phone, email, LicenseNo],
      'Register Customer (Insert)'
    );
    const added = await dbGet('SELECT * FROM Customer WHERE customer_id = ?', [nextId]);
    res.status(201).json(added);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  const { id } = req.params;
  const { CustomerName, phone, email, LicenseNo } = req.body;
  try {
    await dbRun(
      'UPDATE Customer SET CustomerName = ?, phone = ?, email = ?, LicenseNo = ? WHERE customer_id = ?',
      [CustomerName, phone, email, LicenseNo, id],
      'Update Customer (Update)'
    );
    const updated = await dbGet('SELECT * FROM Customer WHERE customer_id = ?', [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun('DELETE FROM Customer WHERE customer_id = ?', [id], 'Delete Customer (Delete)');
    res.json({ message: 'Customer deleted.', deletedId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Vehicles CRUD
app.get('/api/vehicles', async (req, res) => {
  const { search, status } = req.query;
  let q = 'SELECT * FROM Vehicle WHERE 1=1';
  const params = [];
  if (search) {
    q += ' AND (VehicleModel LIKE ? OR VehicleType LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s);
  }
  if (status && status !== 'All') {
    q += ' AND Status = ?';
    params.push(status);
  }
  q += ' ORDER BY VehicleID DESC';
  try {
    const rows = await dbAll(q, params, 'View Fleet');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vehicles', async (req, res) => {
  const { VehicleModel, VehicleType, RentalRate, Status, MaintenanceStatus } = req.body;
  try {
    const maxId = await dbGet('SELECT MAX(VehicleID) as maxVal FROM Vehicle');
    const nextId = (maxId.maxVal || 100) + 1;
    await dbRun(
      'INSERT INTO Vehicle VALUES (?, ?, ?, ?, ?, ?)',
      [nextId, VehicleModel, VehicleType, RentalRate, Status || 'Available', MaintenanceStatus || 'No'],
      'Add Vehicle (Insert)'
    );
    const added = await dbGet('SELECT * FROM Vehicle WHERE VehicleID = ?', [nextId]);
    res.status(201).json(added);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/vehicles/:id', async (req, res) => {
  const { id } = req.params;
  const { VehicleModel, VehicleType, RentalRate, Status, MaintenanceStatus } = req.body;
  try {
    await dbRun(
      'UPDATE Vehicle SET VehicleModel = ?, VehicleType = ?, RentalRate = ?, Status = ?, MaintenanceStatus = ? WHERE VehicleID = ?',
      [VehicleModel, VehicleType, RentalRate, Status, MaintenanceStatus, id],
      'Update Vehicle (Update)'
    );
    const updated = await dbGet('SELECT * FROM Vehicle WHERE VehicleID = ?', [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vehicles/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun('DELETE FROM Vehicle WHERE VehicleID = ?', [id], 'Delete Vehicle (Delete)');
    res.json({ message: 'Vehicle removed.', deletedId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bookings CRUD & Trigger validation
app.get('/api/bookings', async (req, res) => {
  const q = `
    SELECT B.*, C.CustomerName, V.VehicleModel, V.RentalRate, V.Status as VehicleStatus, V.MaintenanceStatus
    FROM Booking B
    JOIN Customer C ON B.CustomerID = C.customer_id
    JOIN Vehicle V ON B.VehicleID = V.VehicleID
    ORDER BY B.BookingID DESC
  `;
  try {
    const rows = await dbAll(q, [], 'View Reservations');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bookings', async (req, res) => {
  const { CustomerID, VehicleID, BookingDate } = req.body;
  try {
    const maxId = await dbGet('SELECT MAX(BookingID) as maxVal FROM Booking');
    const nextId = (maxId.maxVal || 200) + 1;
    
    await dbRun(
      'INSERT INTO Booking VALUES (?, ?, ?, ?)',
      [nextId, CustomerID, VehicleID, BookingDate],
      'Create Booking (Trigger-monitored Insert)'
    );

    logSQL(
      `-- DATABASE TRIGGER EXECUTED AUTOMATICALLY --\nUPDATE Vehicle SET Status = 'Rented' WHERE VehicleID = ${VehicleID};`,
      [],
      'Trigger log: trg_update_vehicle_status'
    );

    const added = await dbGet(`
      SELECT B.*, C.CustomerName, V.VehicleModel
      FROM Booking B
      JOIN Customer C ON B.CustomerID = C.customer_id
      JOIN Vehicle V ON B.VehicleID = V.VehicleID
      WHERE B.BookingID = ?
    `, [nextId]);
    res.status(201).json(added);
  } catch (err) {
    if (err.message.includes('Booking not allowed')) {
      return res.status(400).json({ error: 'Booking blocked by database trigger: Vehicle is currently under maintenance.' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const booking = await dbGet('SELECT * FROM Booking WHERE BookingID = ?', [id]);
    if (booking) {
      await dbRun("UPDATE Vehicle SET Status = 'Available' WHERE VehicleID = ?", [booking.VehicleID]);
    }
    await dbRun('DELETE FROM Booking WHERE BookingID = ?', [id], 'Cancel Booking (Delete)');
    res.json({ message: 'Booking cancelled.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rentals
app.get('/api/rentals', async (req, res) => {
  const q = `
    SELECT R.*, C.CustomerName, V.VehicleModel, V.RentalRate, V.VehicleID
    FROM Rental R
    JOIN Booking B ON R.BookingID = B.BookingID
    JOIN Customer C ON B.CustomerID = C.customer_id
    JOIN Vehicle V ON B.VehicleID = V.VehicleID
    ORDER BY R.RentalID DESC
  `;
  try {
    const rows = await dbAll(q, [], 'View Rentals');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rentals', async (req, res) => {
  const { BookingID, StartDate, EndDate, TotalAmount } = req.body;
  try {
    const maxId = await dbGet('SELECT MAX(RentalID) as maxVal FROM Rental');
    const nextId = (maxId.maxVal || 300) + 1;
    await dbRun(
      'INSERT INTO Rental VALUES (?, ?, ?, ?, ?)',
      [nextId, BookingID, StartDate, EndDate, TotalAmount],
      'Create Rental'
    );
    const added = await dbGet('SELECT * FROM Rental WHERE RentalID = ?', [nextId]);
    res.status(201).json(added);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rentals/:id/return', async (req, res) => {
  const { id } = req.params;
  try {
    const rental = await dbGet('SELECT * FROM Rental WHERE RentalID = ?', [id]);
    if (!rental) return res.status(404).json({ error: 'Rental not found.' });

    const booking = await dbGet('SELECT * FROM Booking WHERE BookingID = ?', [rental.BookingID]);
    if (booking) {
      await dbRun("UPDATE Vehicle SET Status = 'Available' WHERE VehicleID = ?", [booking.VehicleID]);
    }
    res.json({ message: 'Returned successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Payments
app.get('/api/payments', async (req, res) => {
  const q = `
    SELECT P.*, C.CustomerName, V.VehicleModel
    FROM Payment P
    JOIN Rental R ON P.RentalID = R.RentalID
    JOIN Booking B ON R.BookingID = B.BookingID
    JOIN Customer C ON B.CustomerID = C.customer_id
    JOIN Vehicle V ON B.VehicleID = V.VehicleID
    ORDER BY P.PaymentID DESC
  `;
  try {
    const rows = await dbAll(q, [], 'View Payments');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments', async (req, res) => {
  const { RentalID, Amount, PaymentDate, PaymentMethod } = req.body;
  try {
    const maxId = await dbGet('SELECT MAX(PaymentID) as maxVal FROM Payment');
    const nextId = (maxId.maxVal || 400) + 1;
    await dbRun(
      'INSERT INTO Payment VALUES (?, ?, ?, ?, ?)',
      [nextId, RentalID, Amount, PaymentDate, PaymentMethod],
      'Record Payment (Insert)'
    );
    const added = await dbGet('SELECT * FROM Payment WHERE PaymentID = ?', [nextId]);
    res.status(201).json(added);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Maintenance
app.get('/api/maintenance', async (req, res) => {
  const q = `
    SELECT M.*, V.VehicleModel
    FROM Maintenance M
    JOIN Vehicle V ON M.VehicleID = V.VehicleID
    ORDER BY M.MaintenanceID DESC
  `;
  try {
    const rows = await dbAll(q, [], 'View Maintenance Logs');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/maintenance', async (req, res) => {
  const { VehicleID, MaintenanceDate, Description, Cost } = req.body;
  try {
    const maxId = await dbGet('SELECT MAX(MaintenanceID) as maxVal FROM Maintenance');
    const nextId = (maxId.maxVal || 500) + 1;
    await dbRun(
      'INSERT INTO Maintenance VALUES (?, ?, ?, ?, ?)',
      [nextId, VehicleID, MaintenanceDate, Description, Cost],
      'Schedule Maintenance'
    );
    await dbRun("UPDATE Vehicle SET Status = 'Maintenance', MaintenanceStatus = 'Yes' WHERE VehicleID = ?", [VehicleID]);
    const added = await dbGet('SELECT * FROM Maintenance WHERE MaintenanceID = ?', [nextId]);
    res.status(201).json(added);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// STORED PROCEDURE ENDPOINTS
// ============================================================================

// 1. CalculateRentalCharge
app.post('/api/procedures/calculate-charge', async (req, res) => {
  const { VehicleID, Days } = req.body;
  const numDays = parseInt(Days) || 1;
  const vId = parseInt(VehicleID);

  try {
    if (dbMode === 'mysql') {
      logSQL(`-- MYSQL STORED PROCEDURE CALL --\nCALL CalculateRentalCharge(${vId}, ${numDays});`, [], 'Stored Procedure Call');
      
      // Execute the procedure on MySQL. It returns a nested array: [ [ rows ], okPacket ]
      const [resultSets] = await mysqlPool.query('CALL CalculateRentalCharge(?, ?)', [vId, numDays]);
      const result = resultSets[0][0]; // First row of the first result set
      
      if (!result) return res.status(404).json({ error: 'Vehicle not found.' });
      res.json({
        VehicleID: result.VehicleID,
        VehicleModel: result.VehicleModel,
        RentalRate: result.RentalRate,
        NumberOfDays: result.NumberOfDays,
        TotalRentalCharge: result.TotalRentalCharge
      });
    } else {
      // SQLite simulation
      logSQL(`-- SQLITE SIMULATED PROCEDURE CALL --\nCALL CalculateRentalCharge(${vId}, ${numDays});`, [], 'Stored Procedure Call');
      const vehicle = await dbGet('SELECT RentalRate, VehicleModel FROM Vehicle WHERE VehicleID = ?', [vId]);
      if (!vehicle) return res.status(404).json({ error: 'Vehicle not found.' });

      res.json({
        VehicleID: vId,
        VehicleModel: vehicle.VehicleModel,
        RentalRate: vehicle.RentalRate,
        NumberOfDays: numDays,
        TotalRentalCharge: vehicle.RentalRate * numDays
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. VehicleAvailabilityReport
app.get('/api/procedures/availability-report', async (req, res) => {
  try {
    if (dbMode === 'mysql') {
      logSQL(`-- MYSQL STORED PROCEDURE CALL --\nCALL VehicleAvailabilityReport();`, [], 'Stored Procedure Call');
      const [resultSets] = await mysqlPool.query('CALL VehicleAvailabilityReport()');
      res.json(resultSets[0]); // First result set contains the records
    } else {
      // SQLite simulation
      logSQL(`-- SQLITE SIMULATED PROCEDURE CALL --\nCALL VehicleAvailabilityReport();`, [], 'Stored Procedure Call');
      const rows = await dbAll('SELECT VehicleID, VehicleModel, VehicleType, RentalRate, Status FROM Vehicle ORDER BY VehicleID');
      res.json(rows);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// ACADEMIC QUERIES RUNNER
// ============================================================================
const QUERIES_MAP = {
  1: {
    sql: 'SELECT * FROM Vehicle;',
    description: 'Retrieve all vehicles.'
  },
  2: {
    sql: "SELECT * FROM Vehicle WHERE Status = 'Available';",
    description: 'Display vehicles available for rent.'
  },
  3: {
    sql: `SELECT C.customer_id, C.CustomerName, R.RentalID, R.StartDate, R.EndDate, R.TotalAmount
          FROM Customer C
          INNER JOIN Booking B ON C.customer_id = B.CustomerID
          INNER JOIN Rental R ON B.BookingID = R.BookingID;`,
    description: 'Display rental and customer details (2-table INNER JOIN).'
  },
  4: {
    sql: `SELECT C.CustomerName, V.VehicleModel, V.VehicleType, R.StartDate, R.EndDate, R.TotalAmount
          FROM Customer C
          JOIN Booking B ON C.customer_id = B.CustomerID
          JOIN Vehicle V ON B.VehicleID = V.VehicleID
          JOIN Rental R ON B.BookingID = R.BookingID;`,
    description: 'Display rental, customer, and vehicle details (3-table JOIN).'
  },
  5: {
    sql: `SELECT V.VehicleType, COUNT(*) AS TotalRentals
          FROM Vehicle V
          JOIN Booking B ON V.VehicleID = B.VehicleID
          GROUP BY V.VehicleType;`,
    description: 'Count number of rentals per vehicle type (GROUP BY).'
  },
  6: {
    sql: `SELECT V.VehicleType, COUNT(*) AS TotalRentals
          FROM Vehicle V
          JOIN Booking B ON V.VehicleID = B.VehicleID
          GROUP BY V.VehicleType
          HAVING COUNT(*) > 15;`,
    description: 'Display vehicle types having more than 15 rentals (HAVING).'
  },
  7: {
    sql: `SELECT * FROM Vehicle
          WHERE RentalRate > (SELECT AVG(RentalRate) FROM Vehicle);`,
    description: 'Retrieve vehicles whose rental charge is greater than the average rental charge (Subquery).'
  },
  8: {
    sql: `SELECT C.customer_id, C.CustomerName
          FROM Customer C
          WHERE (SELECT COUNT(*) FROM Booking B WHERE B.CustomerID = C.customer_id) >
                (SELECT COUNT(*) FROM Booking WHERE CustomerID = 4);`,
    description: 'Retrieve customers who rented more vehicles than a specific customer (Correlated Subquery).'
  },
  9: {
    sql: `SELECT V.VehicleID, V.VehicleModel, R.RentalID
          FROM Vehicle V
          LEFT JOIN Booking B ON V.VehicleID = B.VehicleID
          LEFT JOIN Rental R ON B.BookingID = R.BookingID;`,
    description: 'Display all vehicles including those not rented (LEFT JOIN).'
  },
  10: {
    sql: `SELECT * FROM Vehicle V
          WHERE NOT EXISTS (SELECT * FROM Booking B WHERE B.VehicleID = V.VehicleID);`,
    description: 'Retrieve vehicles that were never rented (NOT EXISTS).'
  }
};

app.get('/api/academic-queries', (req, res) => {
  res.json(Object.keys(QUERIES_MAP).map(key => ({
    id: key,
    description: QUERIES_MAP[key].description,
    sql: QUERIES_MAP[key].sql
  })));
});

app.post('/api/academic-queries/:id', async (req, res) => {
  const { id } = req.params;
  const qObj = QUERIES_MAP[id];
  if (!qObj) return res.status(404).json({ error: 'Query not found.' });

  try {
    const rows = await dbAll(qObj.sql, [], `Academic Query ${id}`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start DB and Express Server
startDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
});
