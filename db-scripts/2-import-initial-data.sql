INSERT INTO [Makes](
       [Name])
SELECT [ID].[Make]
  FROM [initial-data] AS [ID]
       LEFT OUTER JOIN [Makes] AS [MAK]
	                ON [ID].[Make] = [MAK].[Name]
 WHERE [MAK].[ID] IS NULL -- Couldn't find existing make, create new
       GROUP BY [ID].[Make]; 
	   
INSERT INTO [Models] (
       [MakeID],
	   [Name])
SELECT [MAK].[ID] AS [MakeID],
	   [ID].[BaseModel]
  FROM [initial-data] AS [ID]
       INNER JOIN [Makes] AS [MAK]
	           ON [MAK].[Name] = [ID].[Make]
       LEFT OUTER JOIN [Models] AS [MOD]
	                ON [MOD].[MakeID] = [MAK].[ID]
				   AND [MOD].[Name] = [ID].[BaseModel]
 WHERE [MOD].[ID] IS NULL -- Couldn't find existing model, create new
       GROUP BY [ID].[Make],
	            [MAK].[ID],
				[ID].[BaseModel];
				
INSERT INTO [FuelTypes] ([Description])
SELECT [ID].[Fuel]
  FROM [initial-data] AS [ID]
       LEFT OUTER JOIN [FuelTypes] AS [FT]
	                ON [ID].[Fuel] = [FT].[Description]
 WHERE [FT].[ID] IS NULL -- Fuel type not already in table
       GROUP BY [ID].[Fuel];
	  
WITH [Conversions] ([MilesToKM], [USGallonToLitre], [USMPGtoKMPL]) AS (
SELECT 1.609344              AS [MilesToKM],
       3.78541178            AS [USGallonToLitre],
	   1.609344 / 3.78541178 AS [USMPGtoKMPL])

INSERT INTO [Vehicles] (
	   [ModelID],
	   [ModelDetail],
	   [Year],
	   [FuelID],
	   [Source],
	   [OriginalID],
	   [Displacement],
	   [Cylinders],
	   [UrbanKMPL],
	   [MotorwayKMPL])
SELECT [MOD].[ID] AS [ModelID],
	   [ID].[Model] AS [ModelDetail],
	   [ID].[Year],
	   [FT].[ID] AS [FuelID],
	   [ID].[Source] AS [Source],
	   [ID].[ID] AS [OriginalID],
	   [ID].[Displacement],
	   [ID].[Cylinders],
	   -- Convert Miles to Kilometres
	   -- then convert US gallen to litre
 	   [ID].[UrbanMPG]    * [CONV].[USMPGtoKMPL] AS [UrbamKMPL],
	   [ID].[MotorwayMPG] * [CONV].[USMPGtoKMPL] AS [MotorwayKMPL]
  FROM [initial-data] AS [ID] 
       CROSS JOIN [Conversions] AS [CONV]
       LEFT OUTER JOIN [Models] AS [MOD]
	                ON [ID].[BaseModel] = [MOD].[Name]
       LEFT OUTER JOIN [FuelTypes] AS [FT]
	                ON [ID].[Fuel] = [FT].[Description]
	   LEFT OUTER JOIN [Vehicles] AS [VEH]
	                ON [VEH].[Source] = [ID].[Source]
				   AND [VEH].[OriginalID] = [ID].[ID]
 WHERE [VEH].[ID] IS NULL