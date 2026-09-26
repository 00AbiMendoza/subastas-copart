const bcrypt = require('bcryptjs');
const { sql, getPool, T } = require('./conexion');

// Crea las tablas si no existen. Se ejecuta al iniciar el servidor, así el
// despliegue en un hosting nuevo deja la base lista sin pasos manuales.
const DDL = `
IF OBJECT_ID('${T.usuarios}') IS NULL
CREATE TABLE ${T.usuarios} (
  UsuarioID      INT IDENTITY(1,1) CONSTRAINT PK_edelacruz_Usuarios PRIMARY KEY,
  Nombre         NVARCHAR(80)  NOT NULL,
  Apellido       NVARCHAR(80)  NOT NULL,
  Correo         NVARCHAR(150) NOT NULL CONSTRAINT UQ_edelacruz_Usuarios_Correo UNIQUE,
  Telefono       VARCHAR(20)   NOT NULL,
  PasswordHash   VARCHAR(100)  NOT NULL,
  FechaRegistro  DATETIME2     NOT NULL CONSTRAINT DF_edelacruz_Usuarios_Fecha DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('${T.catalogos}') IS NULL
CREATE TABLE ${T.catalogos} (
  CatalogoID  INT IDENTITY(1,1) CONSTRAINT PK_edelacruz_Catalogos PRIMARY KEY,
  Tipo        VARCHAR(30)  NOT NULL,
  Codigo      VARCHAR(30)  NOT NULL,
  Nombre      NVARCHAR(80) NOT NULL,
  Descripcion NVARCHAR(150) NULL,
  Orden       INT NOT NULL CONSTRAINT DF_edelacruz_Catalogos_Orden DEFAULT 0,
  CONSTRAINT UQ_edelacruz_Catalogos UNIQUE (Tipo, Codigo)
);

IF OBJECT_ID('${T.vehiculos}') IS NULL
CREATE TABLE ${T.vehiculos} (
  VehiculoID        INT IDENTITY(1,1) CONSTRAINT PK_edelacruz_Vehiculos PRIMARY KEY,
  PublicadorID      INT NOT NULL CONSTRAINT FK_edelacruz_Vehiculos_Publicador REFERENCES ${T.usuarios}(UsuarioID),
  Anio              INT NOT NULL,
  TipoArticulo      NVARCHAR(40) NOT NULL,
  Marca             NVARCHAR(60) NOT NULL,
  Modelo            NVARCHAR(80) NOT NULL,
  Motor             NVARCHAR(60) NOT NULL,
  Transmision       NVARCHAR(30) NOT NULL,
  Combustible       NVARCHAR(30) NOT NULL,
  Tren              VARCHAR(3)   NOT NULL CONSTRAINT CK_edelacruz_Vehiculos_Tren CHECK (Tren IN ('AWD','FWD','RWD','4WD')),
  Cilindros         INT NOT NULL,
  Dano              VARCHAR(8)   NOT NULL CONSTRAINT CK_edelacruz_Vehiculos_Dano CHECK (Dano IN ('VERDE','AMARILLO','ROJO')),
  Descripcion       NVARCHAR(1000) NULL,
  MontoBase         DECIMAL(12,2) NOT NULL CONSTRAINT CK_edelacruz_Vehiculos_Base CHECK (MontoBase > 0),
  FechaInicio       DATETIME2 NOT NULL,
  FechaFin          DATETIME2 NOT NULL,
  MontoActual       DECIMAL(12,2) NULL,
  GanadorID         INT NULL CONSTRAINT FK_edelacruz_Vehiculos_Ganador REFERENCES ${T.usuarios}(UsuarioID),
  TotalPujas        INT NOT NULL CONSTRAINT DF_edelacruz_Vehiculos_Total DEFAULT 0,
  EstadoCierre      VARCHAR(10) NULL CONSTRAINT CK_edelacruz_Vehiculos_Cierre CHECK (EstadoCierre IN ('VENDIDA','DESIERTA')),
  FechaCreacion     DATETIME2 NOT NULL CONSTRAINT DF_edelacruz_Vehiculos_Creacion DEFAULT SYSUTCDATETIME(),
  FechaModificacion DATETIME2 NULL,
  CONSTRAINT CK_edelacruz_Vehiculos_Fechas CHECK (FechaFin > FechaInicio)
);

IF OBJECT_ID('${T.fotos}') IS NULL
CREATE TABLE ${T.fotos} (
  FotoID      INT IDENTITY(1,1) CONSTRAINT PK_edelacruz_VehiculoFotos PRIMARY KEY,
  VehiculoID  INT NOT NULL CONSTRAINT FK_edelacruz_Fotos_Vehiculo REFERENCES ${T.vehiculos}(VehiculoID) ON DELETE CASCADE,
  Orden       INT NOT NULL,
  ContentType VARCHAR(40) NULL,
  Datos       VARBINARY(MAX) NULL,
  Url         NVARCHAR(1000) NULL
);

IF OBJECT_ID('${T.pujas}') IS NULL
BEGIN
  CREATE TABLE ${T.pujas} (
    PujaID     INT IDENTITY(1,1) CONSTRAINT PK_edelacruz_Pujas PRIMARY KEY,
    VehiculoID INT NOT NULL CONSTRAINT FK_edelacruz_Pujas_Vehiculo REFERENCES ${T.vehiculos}(VehiculoID),
    UsuarioID  INT NOT NULL CONSTRAINT FK_edelacruz_Pujas_Usuario REFERENCES ${T.usuarios}(UsuarioID),
    Monto      DECIMAL(12,2) NOT NULL,
    Fecha      DATETIME2 NOT NULL CONSTRAINT DF_edelacruz_Pujas_Fecha DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_edelacruz_Pujas_Vehiculo ON ${T.pujas} (VehiculoID, Monto DESC);
END`;

const CATALOGOS = {
  TIPO_ARTICULO: ['Automóvil', 'SUV', 'Pickup', 'Van / Microbús', 'Camión', 'Motocicleta'],
  COMBUSTIBLE: ['Gasolina', 'Diésel', 'Híbrido', 'Eléctrico', 'Gas (GLP)'],
  TRANSMISION: ['Automática', 'Manual', 'CVT'],
  TREN: ['AWD', 'FWD', 'RWD', '4WD'],
  MARCA: [
    'Audi', 'BMW', 'Chevrolet', 'Dodge', 'Ford', 'GMC', 'Honda', 'Hyundai', 'Isuzu', 'Jeep', 'Kia', 'Lexus',
    'Mazda', 'Mercedes-Benz', 'Mitsubishi', 'Nissan', 'RAM', 'Subaru', 'Suzuki', 'Tesla', 'Toyota', 'Volkswagen', 'Yamaha',
  ],
};

const DANOS = [
  ['VERDE', 'Verde', 'Daño menor / Limpio'],
  ['AMARILLO', 'Amarillo', 'Daño medio / Reparable'],
  ['ROJO', 'Rojo', 'Daño severo / Salvamento'],
];

// Usuarios de prueba para que el catedrático haga pujas cruzadas entre navegadores.
const USUARIOS_PRUEBA = [
  { nombre: 'Ana', apellido: 'López', correo: 'ana@subastas.test', telefono: '5555-0001' },
  { nombre: 'Bruno', apellido: 'Pérez', correo: 'bruno@subastas.test', telefono: '5555-0002' },
  { nombre: 'Carla', apellido: 'Méndez', correo: 'carla@subastas.test', telefono: '5555-0003' },
];
const PASSWORD_PRUEBA = 'Prueba#2026';

const codigo = (texto) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

async function inicializarBD() {
  const pool = await getPool();
  await pool.request().batch(DDL);

  const filas = [];
  for (const [tipo, valores] of Object.entries(CATALOGOS)) {
    valores.forEach((nombre, i) => filas.push([tipo, codigo(nombre), nombre, null, i]));
  }
  DANOS.forEach(([cod, nombre, desc], i) => filas.push(['DANO', cod, nombre, desc, i]));

  for (const [tipo, cod, nombre, desc, orden] of filas) {
    await pool.request()
      .input('tipo', sql.VarChar(30), tipo)
      .input('codigo', sql.VarChar(30), cod)
      .input('nombre', sql.NVarChar(80), nombre)
      .input('desc', sql.NVarChar(150), desc)
      .input('orden', sql.Int, orden)
      .query(`IF NOT EXISTS (SELECT 1 FROM ${T.catalogos} WHERE Tipo = @tipo AND Codigo = @codigo)
              INSERT INTO ${T.catalogos} (Tipo, Codigo, Nombre, Descripcion, Orden) VALUES (@tipo, @codigo, @nombre, @desc, @orden)`);
  }

  const hash = await bcrypt.hash(PASSWORD_PRUEBA, 10);
  for (const u of USUARIOS_PRUEBA) {
    await pool.request()
      .input('nombre', sql.NVarChar(80), u.nombre)
      .input('apellido', sql.NVarChar(80), u.apellido)
      .input('correo', sql.NVarChar(150), u.correo)
      .input('telefono', sql.VarChar(20), u.telefono)
      .input('hash', sql.VarChar(100), hash)
      .query(`IF NOT EXISTS (SELECT 1 FROM ${T.usuarios} WHERE Correo = @correo)
              INSERT INTO ${T.usuarios} (Nombre, Apellido, Correo, Telefono, PasswordHash)
              VALUES (@nombre, @apellido, @correo, @telefono, @hash)`);
  }
}

module.exports = { inicializarBD, USUARIOS_PRUEBA, PASSWORD_PRUEBA };
