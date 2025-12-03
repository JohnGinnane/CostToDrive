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
	   	   
/* 2025-12-02 - Added source table */
/* Must be created before [Vehicles] so we can use FK */
CREATE TABLE IF NOT EXISTS [Sources] (
	   [ID]           INTEGER      NOT NULL,
       [URL]          TEXT         NOT NULL,
       [DateAdded]    TIMESTAMP    NOT NULL   DEFAULT CURRENT_TIMESTAMP,
       
	   PRIMARY KEY ([ID] AUTOINCREMENT)
);

CREATE TABLE IF NOT EXISTS [Vehicles] (
       [ID]           INTEGER      NOT NULL, -- This is our ID
	   --[MakeID]       INTEGER      NOT NULL, -- We can get the make details via model FK
	   [ModelID]      INTEGER      NOT NULL,
	   [ModelDetail]  TEXT         NOT NULL, -- No normalisation here, as one "base model" can have many variants
	   [Year]         INTEGER      NOT NULL,
	   [FuelID]       INTEGER      NOT NULL,
	   [SourceID]     INTEGER          NULL, -- Where did we get this vehicle's data?
	   [OriginalID]   TEXT             NULL, -- What is the ID for this vehicle in the above source?
	   [Displacement] REAL             NULL,
	   [Cylinders]    INTEGER          NULL,
	   [UrbanKMPL]    REAL             NULL, -- Kilometres per Litre
	   [MotorwayKMPL] REAL             NULL,
	   
	   PRIMARY KEY ([ID] AUTOINCREMENT),
	   CONSTRAINT  [FK_ModelID]  FOREIGN KEY ([ModelID])  REFERENCES [Models]([ID]),
	   CONSTRAINT  [FK_FuelID]   FOREIGN KEY ([FuelID])   REFERENCES [FuelTypes]([ID]),
	   CONSTRAINT  [FK_SourceID] FOREIGN KEY ([SourceID]) REFERENCES [Sources]([ID]));

/* 2025-12-02 - Added currency log table */
CREATE TABLE [CurrencyConversionLog] (
       [ID]           INTEGER,
       [SourceID]     INTEGER,
       [Batch]        INTEGER      NOT NULL, -- This will be a number that tied multiple entries together
       [Timestamp]    TIMESTAMP    NOT NULL   DEFAULT CURRENT_TIMESTAMP,
       [Currency]     TEXT         NOT NULL, -- In the standard 3 letter format of "EUR"
       [Value]        REAL         NOT NULL,
	   
       PRIMARY KEY ([ID] AUTOINCREMENT),
	   CONSTRAINT  [FK_SourceID] FOREIGN KEY ([SourceID]) REFERENCES [Sources]([ID]));