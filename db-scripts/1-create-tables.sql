/* 2025-11-06 - Initial tables */
CREATE TABLE IF NOT EXISTS [Makes] (
	[ID]		INTEGER,
	[Name]		TEXT		 NOT NULL,
	PRIMARY KEY ([ID] AUTOINCREMENT)
);

CREATE TABLE IF NOT EXISTS [Models] (
	[ID]		INTEGER,
	[MakeID]	INTEGER 	NOT NULL,
	[Name]		TEXT 		NOT NULL,
	
	PRIMARY KEY ([ID] AUTOINCREMENT),
	CONSTRAINT  [FK_MakeID] FOREIGN KEY ([MakeID]) REFERENCES [Makes]([ID])
);

/* 2025-11-09 - Added vehicles and fuel types  */
CREATE TABLE IF NOT EXISTS [FuelTypes] (
       [ID]           INTEGER      NOT NULL,
	   [Description]  TEXT         NOT NULL,
	   PRIMARY KEY ([ID] AUTOINCREMENT));
	   

CREATE TABLE IF NOT EXISTS [Vehicles] (
       [ID]           INTEGER      NOT NULL, -- This is our ID
	   --[MakeID]       INTEGER      NOT NULL, -- We can get the make details via model FK
	   [ModelID]      INTEGER      NOT NULL,
	   [ModelDetail]  TEXT         NOT NULL, -- No normalisation here, as one "base model" can have many variants
	   [Year]         INTEGER      NOT NULL,
	   [FuelID]       INTEGER      NOT NULL,
	   [Source]       TEXT             NULL, -- Where did we get this vehicle's data?
	   [OriginalID]   TEXT             NULL, -- What is the ID for this vehicle in the above source?
	   [Displacement] REAL             NULL,
	   [Cylinders]    INTEGER          NULL,
	   [UrbanKMPL]    REAL             NULL, -- Kilometres per Litre
	   [MotorwayKMPL] REAL             NULL,
	   
	   PRIMARY KEY ([ID] AUTOINCREMENT),
	   CONSTRAINT  [FK_ModelID] FOREIGN KEY ([ModelID]) REFERENCES [Models]([ID]),
	   CONSTRAINT  [FK_FuelID]  FOREIGN KEY ([FuelID])  REFERENCES [FuelTypes]([ID]));