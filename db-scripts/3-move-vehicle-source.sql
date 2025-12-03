/* 2025-12-02 - Convert Source (url) to Source ID (int) */
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS [TMP_Vehicles];

-- Create new table with updated type
CREATE TABLE IF NOT EXISTS [TMP_Vehicles] (
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

-- Insert existing source (if not already there)
INSERT INTO [Sources] ([URL])
SELECT [VEH].[Source]
  FROM [Vehicles] AS [VEH]
       LEFT OUTER JOIN [Sources] AS [SRC]
	                ON [VEH].[Source] = [SRC].[URL]
 WHERE [SRC].[ID] IS NULL -- Source doesn't exist yet
       GROUP BY [VEH].[Source];
	   
-- Copy existing data into temp table, replacing column
INSERT INTO [TMP_Vehicles] (
       [ID],
	   [ModelID],
	   [ModelDetail],
	   [Year],
	   [FuelID],
	   [SourceID],
	   [OriginalID],
	   [Displacement],
	   [Cylinders],
	   [UrbanKMPL],
	   [MotorwayKMPL])
SELECT [VEH].[ID],
	   [VEH].[ModelID],
	   [VEH].[ModelDetail],
	   [VEH].[Year],
	   [VEH].[FuelID],
	   [SRC].[ID],
	   [VEH].[OriginalID],
	   [VEH].[Displacement],
	   [VEH].[Cylinders],
	   [VEH].[UrbanKMPL],
	   [VEH].[MotorwayKMPL]
  FROM [Vehicles] AS [VEH]
       LEFT OUTER JOIN [Sources] AS [SRC]
	                ON [VEH].[Source] = [SRC].[URL]
	   LEFT OUTER JOIN [TMP_Vehicles] AS [TMP]
	                ON [VEH].[ID] = [TMP].[ID]
 WHERE [TMP].[ID] IS NULL; -- Not already moved
					
-- Delete original table
DROP TABLE [Vehicles];

-- Finally rename temp table to original
ALTER TABLE [TMP_Vehicles]
      RENAME TO [Vehicles];
