// Immediately open a web socket to the server
// This allows us to stream async data from web
// server to the client's page
const webSocket = new WebSocket('ws://localhost:3001', null, null, null, {rejectUnauthorized: false});
//const webSocket = new WebSocket('wss://localhost:3001', 'echo-protocol');

webSocket.onopen = (event) => {
    console.log("Web socket opened!");

    // First first cost-to-drive container and request makes for it
    var firstContainer = $("div.ctd-container:first")[0];
    
    requestMakes(firstContainer.id);
    requestCurrencyConversion();
}

//// Session Variables ////
let avgUrbanKMPL        = 0.0;
let avgMotorwayKMPL     = 0.0;
let lastFuelEconomyUnit = "";
let lastDistanceUnit    = "";
let currencyConversion  = null;

//#region Functions

function findByID(containerID) {
    return $("#" + containerID);
}

function coerceNumber(val) {
    // remove any comma separators
    if (!val) { return; }
    if (typeof val == "number") { return val; }
    if (typeof val != "string") { return; }

    // remove commas from "1,234.56"
    val = val.replaceAll(",", "");

    if (!isNaN(val) && !isNaN(parseFloat(val))) {
        return parseFloat(val);
    }
}

function getSelectedValue(selectNode) {
    return $(selectNode).find(":selected").val().trim();
}

function getSelectedFuelEconomyUnit(parentContainer) {
    var test = $(parentContainer).find("select.ctd-fuel-eco-unit");
    return $(parentContainer).find("select.ctd-fuel-eco-unit").first().val().trim().toLowerCase();
}

function convertFuelEco(curValue, curUnit, newUnit) {
    if (!curValue) { return; }
    if (!curUnit)  { return curValue; }
    if (!newUnit)  { return curValue; }

    curValue = Number(curValue);
    curUnit  = curUnit.trim().toLowerCase();
    newUnit  = newUnit.trim().toLowerCase();

    if (curUnit === newUnit) { return curValue; }

    // First convert to kilometre per litre (kmpl)
    // then convert to other unit
    var newValue = curValue;
    
    // All conversion formulae are taken from
    // https://www.unitconverters.net/fuel-consumption-converter.html
    
    switch (curUnit) {
        case "lp100km":
            newValue = 100.00 / curValue;
            break;
        
        case "mpguk":
            newValue = curValue * 0.35400619;
            break;

        case "mpgus":
            newValue = curValue * 0.4251437075;
            break;
    }

    switch (newUnit) {
        case "kmpl":
            return newValue;

        case "lp100km":
            return 100.00 / newValue;

        case "mpguk":
            return newValue * 2.8248093628;

        case "mpgus":
            return newValue * 2.3521458329;
    }

    // Default case
    return curValue;
}

function convertDistance(curValue, curUnit, newUnit) {
    if (!curValue) { return; }
    if (!curUnit)  { return curValue; }
    if (!newUnit)  { return curValue; }

    curValue = coerceNumber(curValue);
    curUnit  = curUnit.trim().toLowerCase();
    newUnit  = newUnit.trim().toLowerCase();

    // As before, let's convert to KM first
    var newValue = curValue;

    switch (curUnit) {
        case "km":
            newValue = curValue;
            break;

        case "m":
            newValue = curValue * 1.609344;
            break;
    }

    // Now see what we need to convert into
    switch (newUnit) {
        case "km":
            break;

        case "m":
            newValue = curValue * 0.6213711922;
            break;
    }

    return newValue;
}

function convertCurrency(curValue, curUnit, newUnit) {
    if (!curValue) { return; }
    if (!curUnit)  { return curValue; }
    if (!newUnit)  { return curValue; }

    curValue = coerceNumber(curValue);
    curUnit = curUnit.trim().toUpperCase();
    newUnit = newUnit.trim().toUpperCase();

    if (curUnit == newUnit)  { return curValue; }
    if (!currencyConversion) { return; }
    if (!currencyConversion.rates[curUnit] || !currencyConversion.rates[newUnit]) { return; }
    
    var newValue = curValue;

    // Convert from curUnit to EUR
    newValue = newValue / currencyConversion.rates[curUnit];
    // Then convert from EUR to newUnit
    newValue = newValue * currencyConversion.rates[newUnit];

    return newValue;
}

function updateFuelEco(parentContainer, newValue) {
    var inputFuelEco = $(parentContainer).find("input.ctd-fuel-eco").first();

    if (!newValue) {
        newValue = coerceNumber($(inputFuelEco).val());
    }

    var selectFuelEcoUnit = $(parentContainer).find("select.ctd-fuel-eco-unit").first()[0];
    
    if ($(selectFuelEcoUnit).data("previous-value")) {
        var preUnit = $(selectFuelEcoUnit).data("previous-value").trim().toLowerCase();
        var newUnit = $(selectFuelEcoUnit).val().trim().toLowerCase();

        newValue = convertFuelEco(newValue, preUnit, newUnit);
    }
    
    if (newValue) {
        $(inputFuelEco).val(newValue.toFixed(2));
    }
}

function calculateCostToDrive(parentContainer) {
    if (!parentContainer) { return; }

    var fuelPrice      = $(parentContainer).find("input.ctd-fuel-price").first().val();
    var distance       = $(parentContainer).find("input.ctd-distance").first().val();
    var fuelEconomy    = $(parentContainer).find("input.ctd-fuel-eco").first().val();

    var preDistUnit    = $(parentContainer).find("input.ctd-distance-unit").first().val();
    var preFuelEcoUnit = $(parentContainer).find("select.ctd-fuel-eco-unit").first().val();

    // Convert values into common units:
    // 1. Distance     -> Kilometres
    // 2. Fuel Economy -> Kilometres per Litre
    distance = coerceNumber(convertDistance(distance, preDistUnit, "km"));
    fuelEconomy = coerceNumber(convertFuelEco(fuelEconomy, preFuelEcoUnit, "kmpl"));

    if (!fuelEconomy) { return; }

    var totalLitres = distance / fuelEconomy;
    var totalCost = totalLitres * coerceNumber(fuelPrice);

    var inputTotalCost = $(parentContainer).find("input.ctd-total-cost").first();

    $(inputTotalCost).val(formatNumber(totalCost));
}

function numericChanged(e) {
    var previousValue = $(this).data("previous-value");
    var newValue = $(this).val();

    if (!newValue) {
        $(this).val(previousValue);
        return;
    }

    // Try to convert the new value into a number to make sure it's good
    if (typeof newValue != "string") {
        $(this).val(previousValue);
        return;
    }

    // Remove commas from the number
    newValue = formatNumber(coerceNumber(newValue));
    $(this).val(newValue);
}

function formatNumber(val, locale = undefined, decimalPlaces = 2) {
    if (!val) { return; }
    decimalPlaces = decimalPlaces || 2;

    var numberFormat = new Intl.NumberFormat(locale, 
                                             { minimumFractionDigits: decimalPlaces, 
                                               maximumFractionDigits: decimalPlaces });
    
    return numberFormat.format(val);
}

function findParentContainer(node) {
    var curNode = node;

    while (curNode) {
        if (curNode.classList.contains("ctd-container")) {
            return curNode;
        }

        curNode = curNode.parentElement;
    }
}

function findParameterValues(parentContainer) {
    return {
        makeID:     Number($(parentContainer).find("select.ctd-make").first().val()),
        modelID:    Number($(parentContainer).find("select.ctd-model").first().val()),
        year:       Number($(parentContainer).find("select.ctd-year").first().val()),
        fuelTypeID: Number($(parentContainer).find("select.ctd-fuel-type").first().val()),
        engineSize: Number($(parentContainer).find("select.ctd-engine-size").first().val())
    }
}

//#endregion

//#region Request Functions

function requestCurrencyConversion() {
    let req = {
        action: "requestCurrencyConversion"
    }

    webSocket.send(JSON.stringify(req));
}

function requestMakes(containerID) {
    let req = {
        action:      "requestMakes",
        containerID: containerID
    }

    webSocket.send(JSON.stringify(req));
}

function requestModels(containerID, makeID) {
    let req = {
        action:      "requestModels",
        containerID: containerID, // I dont love this but it might just work
        makeID:      makeID
    }

    webSocket.send(JSON.stringify(req));
}

function requestYears(containerID, makeID, modelID) {
    let req = {
        action:      "requestYears",
        containerID: containerID, // I dont love this but it might just work
        makeID:      makeID,
        modelID:     modelID
    }

    webSocket.send(JSON.stringify(req));
}

function requestFuelTypes(containerID, makeID, modelID, year) {
    let req = {
        action:      "requestFuelTypes",
        containerID: containerID, // I dont love this but it might just work
        makeID:      makeID,
        modelID:     modelID,
        year:        year
    }

    webSocket.send(JSON.stringify(req));
}

function requestEngineSizes(containerID, makeID, modelID, year, fuelTypeID) {
    let req = {
        action:     "requestEngineSizes",
        containerID: containerID, // I dont love this but it might just work
        makeID:      makeID,
        modelID:     modelID,
        year:        year,
        fuelTypeID:  fuelTypeID
    }

    webSocket.send(JSON.stringify(req));
}

function requestFuelEconomies(containerID, makeID, modelID, year, fuelTypeID, engineSize) {
    let req = {
        action:      "requestFuelEconomies",
        containerID: containerID, // I dont love this but it might just work
        makeID:      makeID,
        modelID:     modelID,
        year:        year,
        fuelTypeID:  fuelTypeID,
        engineSize:  engineSize
    }

    webSocket.send(JSON.stringify(req));
}

function requestFuelPrices(countryCode, fuelID) {
    let req = {
        action:      "requestFuelPrices",
        containerID: containerID, // I dont love this but it might just work
        countryCode: countryCode,
        fuelID:      fuelID
    }

    webSocket.send(JSON.stringify(req));
}

//#endregion

//#region Response Functions

function addNewMake(container, makeID, name) {
    var selectMake = $(container).find("select.ctd-make").first();

    if (selectMake) {
        var newOption = document.createElement("option");
        newOption.value = makeID;
        newOption.text  = name;

        selectMake.append(newOption);
    }
}

function addNewModel(container, modelID, name) {
    // Look for a "ctd-model" class within our container
    var selectModel = $(container).find("select.ctd-model").first();

    if (selectModel) {
        let newOption   = document.createElement("option");
        newOption.value = modelID;
        newOption.text  = name;

        selectModel.append(newOption);
    }
}

function addNewYear(container, year) {
    var selectYear = $(container).find("select.ctd-year").first();

    if (selectYear) {
        var newOption   = document.createElement("option");
        newOption.value = year;
        newOption.text  = year;

        selectYear.append(newOption);
    }
}

function addNewFuelType(container, fuelTypeID, description) {
    selectFuelType = $(container).find("select.ctd-fuel-type").first();

    if (selectFuelType) {
        var newOption   = document.createElement("option");
        newOption.value = fuelTypeID;
        newOption.text  = description;

        selectFuelType.append(newOption);
    }
}

function addNewEngineSize(container, engineSize) {
    var selectEngineSize = $(container).find("select.ctd-engine-size");

    if (selectEngineSize) {
        var newOption   = document.createElement("option");
        newOption.value = engineSize;
        newOption.text  = engineSize.toFixed(1);

        selectEngineSize.append(newOption);
    }
}

function updateFuelPrice(container, fuelPrices) {
    console.log(fuelPrices);

    if (!fuelPrices) {
        return;
    }

    var selectedFuelTypeID = $(container).find("select.ctd-fuel-type").first().find(":selected").val().trim();
    var selectedCurrency   = $(container).find("select.ctd-price-currency").first().find(":selected").val().trim();
    var inputFuelPrice     = $(container).find("input.ctd-fuel-price").first();
    
    Object.keys(fuelPrices.prices).forEach((fuelName) => {
        var fuelPrice = fuelPrices.prices[fuelName];
        console.log(fuelPrice);

        if (!fuelPrice) { return; }
        if (!fuelPrice.fuelID) { return; }

        if (fuelPrice.fuelID == selectedFuelTypeID) {
            var fuelCurrency = fuelPrice.currency;
            var fuelPrice    = Number(fuelPrice.price);

            fuelPrice = convertCurrency(fuelPrice, fuelCurrency, selectedCurrency);
            $(inputFuelPrice).val(formatNumber(fuelPrice));
        }
    });
}

//#endregion

//#region Clear Selection
// Define last selector function first
// then each subsequent function
// will call the previously
// defined function, chaining them

function clearEngineSizeOptions(container) {
    var selectEngineSize = $(container).find("select.ctd-engine-size").first();
    selectEngineSize.empty();
    selectEngineSize.append("<option value='' selected>Select an Engine Size</option>");
}

function clearFuelTypeOptions(container) {
    var selectFuelType = $(container).find("select.ctd-fuel-type").first();

    if (selectFuelType) {
        selectFuelType.empty();
        selectFuelType.append("<option value='' selected>Select a Fuel Type</option>");
    }

    clearEngineSizeOptions(container);
}

function clearYearOptions(container) {
    var selectYear = $(container).find("select.ctd-year").first();

    if (selectYear) {
        selectYear.empty();
        selectYear.append("<option value='' selected>Select a Year</option>")
    }
    
    clearFuelTypeOptions(container);
}

function clearModelOptions(container) {
    // Look for a "ctd-model" class within our container
    var selectModel = $(container).find("select.ctd-model").first();

    if (selectModel) {
        selectModel.empty();
        selectModel.append("<option value='' selected>Select a Model</option>");
    }

    clearYearOptions(container);
}

function clearMakeOptions(container) {
    var selectMake = $(container).find("select.ctd-make").first();

    if (selectMake) {
        selectMake.empty();
        selectMake.append("<option value='' selected>Select a Make</option>");
    }

    clearModelOptions(container);
}

//#endregion

//#region Websocket Response

webSocket.onmessage = (msg) => {
    let resp = JSON.parse(msg.data);
    var type = resp.type.trim().toLowerCase();
    var container = findByID(resp.containerID);

    switch (type) {
        case "make":
            addNewMake(container, Number(resp.data.MakeID), resp.data.Name);
            break;

        case "model":
            addNewModel(container, Number(resp.data.ModelID), resp.data.Name);
            break;

        case "year":
            addNewYear(container, Number(resp.data.Year));
            break;

        case "fueltype":
            addNewFuelType(container, Number(resp.data.FuelTypeID), resp.data.Description);
            break;

        case "enginesize":
            addNewEngineSize(container, Number(resp.data.EngineSize));
            break;

        case "fueleconomy":
            $(container).data("avgUrbanKMPL",    Number(resp.data.AvgUrbanKMPL));
            $(container).data("avgMotorwayKMPL", Number(resp.data.AvgMotorwayKMPL));
            
            // Manually trigger the "change" event so we can
            // calculate the eco
            $("#input-driving-style").trigger("change");
            break;

        case "currencyconversion":
            currencyConversion = resp.data;
            break;

        case "fuelprices":
            // When we receive fuel data, we need to check what selected
            // fuel type, and currency, and then place value into field
            updateFuelPrice(resp.data);
            break;

        default:
            break;
    }
}

//#endregion

//#region Selection Changed

// Events for when a selection is changed
function makeChanged(sender) {
    // First find the parent container
    // Then clear out the next parameter (model)
    // then fetch the models for this make
    // then populate the dropdown with those (async)

    var parentContainer = findParentContainer(sender);

    // Clear out subsequent parameters using the parent ID
    if (parentContainer) {
        clearModelOptions(parentContainer);

        var selectedParameters = findParameterValues(parentContainer);
        requestModels(parentContainer.id, selectedParameters.makeID);
    }

}

function modelChanged(sender) {
    var parentContainer = findParentContainer(sender);

    if (parentContainer) {
        clearYearOptions(parentContainer);

        var selectedParameters = findParameterValues(parentContainer);

        requestYears(parentContainer.id,
                     selectedParameters.makeID,
                     selectedParameters.modelID);
    }

}

function yearChanged(sender) {
    var parentContainer = findParentContainer(sender);

    if (parentContainer) {
        clearFuelTypeOptions(parentContainer);

        var selectedParameters = findParameterValues(parentContainer);

        requestFuelTypes(parentContainer.id,
                         selectedParameters.makeID,
                         selectedParameters.modelID,
                         selectedParameters.year);
    }

}

function fuelTypeChanged(sender) {
    var parentContainer = findParentContainer(sender);

    if (parentContainer) {
        clearEngineSizeOptions(parentContainer);

        var selectedParameters = findParameterValues(parentContainer);

        requestEngineSizes(parentContainer.id,
                           selectedParameters.makeID,
                           selectedParameters.modelID,
                           selectedParameters.year,
                           selectedParameters.fuelTypeID)
    }
}

function engineSizeChanged(sender) {
    var parentContainer = findParentContainer(sender);

    if (parentContainer) {
        var selectedParameters = findParameterValues(parentContainer);

        if (selectedParameters) {
            requestFuelEconomies(parentContainer.id,
                                 selectedParameters.makeID,
                                 selectedParameters.modelID,
                                 selectedParameters.year,
                                 selectedParameters.fuelTypeID,
                                 selectedParameters.engineSize);
        }
    }
}

//#endregion

//#region Parameter Changed

// Whenever the driving style range changes
// we need to recalculate the fuel economy
function drivingStyleChanged(sender) {
    var parentContainer = findParentContainer(sender);

    if (!parentContainer) { return; }

    var avgMotorwayKMPL     = Number($(parentContainer).data("avgMotorwayKMPL"));
    var avgUrbanKMPL        = Number($(parentContainer).data("avgUrbanKMPL"));
    var economyDifference   = Math.abs(avgMotorwayKMPL - avgUrbanKMPL);
    var drivingStylePercent = Number(sender.value) / 100.00;
    var expectedEconomy = 1;

    if (avgMotorwayKMPL > avgUrbanKMPL) {
        expectedEconomy = avgUrbanKMPL    + (economyDifference * drivingStylePercent);
    } else {
        expectedEconomy = avgMotorwayKMPL + (economyDifference * drivingStylePercent);
    }

    expectedEconomy = convertFuelEco(expectedEconomy, 'kmpl', getSelectedFuelEconomyUnit(parentContainer));
    
    updateFuelEco(parentContainer, expectedEconomy);
}

// Recalculate if we changed unit of measurement
function fuelEcoUnitChanged(sender) {
    var parentContainer = findParentContainer(sender);

    if (!parentContainer) { return; }

    var preUnit = $(sender).data("previous-value").trim().toLowerCase();
    var newUnit = $(sender).val().trim().toLowerCase();
    
    if (newUnit === preUnit) { return; }

    updateFuelEco(parentContainer);
    
    $(sender).data("previous-value", newUnit);
}

function fuelEcoUnitFocused(sender) {
    $(sender).data("previous-value", $(sender).val());
}

// Store the original value when we focus on a numeric field
$(".numeric-2").on("focusin", function (e) {
    $(this).data("previous-value", $(this).val());
});

// Format any fields that are "Numeric" to look like numbers
$(".numeric-2").on("keydown", function (e) {
    //console.log("keydown: " + e.keyCode + " => " + String.fromCharCode(e.keyCode));

    if (e.ctrlKey)  { return; }
    if (e.shiftKey || e.keyCode == 16 ) { 
        e.preventDefault();
        return;
    }

    // Only allow these keys
    if ((e.keyCode >=  48 && e.keyCode <=  57) || 
        (e.keyCode >=  96 && e.keyCode <= 105) || 
        (e.keyCode >= 112 && e.keyCode <= 123) ||
         e.keyCode ==   8 ||  // Backspace
         e.keyCode ==   9 ||  // Tab
         e.keyCode ==  35 ||  // End
         e.keyCode ==  36 ||  // Home
         e.keyCode ==  37 ||  // Left arrow
         e.keyCode ==  38 ||  // Up arrow
         e.keyCode ==  39 ||  // Right arrow
         e.keyCode ==  40 ||  // Down arrow 
         e.keyCode ==  44 ||  // Print Screen
         e.keyCode ==  46 ||  // Delete key
         e.keyCode == 109 ||  // Num pad minus symbol
         e.keyCode == 110 ||  // Num pad decimal place
         e.keyCode == 172 ||  // Num pad minus symbol
         e.keyCode == 188 ||  // Comma
         e.keyCode == 190 ) { // Decimal place
        // Good
    } else {
        // Any other non-numeric 
        e.preventDefault();
    }

    // Does the current value already have a full stop?
    var curValue = $(this).val();

    if (!curValue) { return; }

    if (curValue.indexOf(".") > 0 && (e.keyCode == 190 || e.keyCode == 110)) {
        e.preventDefault();
    }
});

// Recalculate cost if any of these fields change
$(".calc-cost").on("change", function(e) {
    calculateCostToDrive();
});

// Add the event handler to all elements with .numeric-2 
$(".numeric-2").each( function() {
    $(this).on("change", numericChanged);
});

function distanceChanged(sender) {
    console.log("test");
    var parentContainer = findParentContainer(sender);
    if (!parentContainer) { return; }

    calculateCostToDrive(parentContainer);
}

// Handle distance conversion
function distanceUnitFocused(sender) {
    $(sender).data("previous-value", $(sender).val());
}

function distanceUnitChanged(sender) {
    var parentContainer = findParentContainer(sender);

    if (!parentContainer) { return; }

    // Find the element that holds our distance
    var inputDistance = $(parentContainer).find("input.ctd-distance").first()[0];
    
    if (!inputDistance) { return; }

    // Check if units changed
    var preUnit = $(sender).data("previous-value").trim().toLowerCase();
    var newUnit = $(sender).val().trim().toLowerCase();
    
    if (preUnit == newUnit) { return; }

    var newDistance = convertDistance($(inputDistance).val(), preUnit, newUnit);

    $(inputDistance).val(formatNumber(newDistance));

    // Set previous unit in case we change unit again while
    // remaining focused on this element
    $(sender).data("previous-value", $(sender).val());
}

// Handle currency conversion
$(".currency-selector").on("focusin", function(e) {
    $(this).data("previous-value", $(this).val());
});

$(".currency-selector").on("change", function(e) {
    var previousCurrency = $(this).data("previous-value").trim().toUpperCase();
    var newCurrency      = $(this).val().trim().toUpperCase();
    var thisID           = e.target.id;

    if (previousCurrency == newCurrency) { return;  }

    // Set our previous currency
    $(this).data("previous-value", newCurrency);

    if (currencyConversion) {
        // Get list of all currency holding fields and convert them
        $(".currency-field").each((k, v) => {
            //console.log(`(${v.id}) ${previousCurrency} ${v.value} -> ${newCurrency}`);
            var curValue = v.value;
            var newValue = convertCurrency(curValue, previousCurrency, newCurrency);

            if (newValue) { 
                v.value = formatNumber(newValue);
            }
        });
    }

    // Apply the change to all other currency selectors
    $(".currency-selector").each((k, v) => {
        if (v.id != thisID) {
            v.value = newCurrency;
        }
    });

    calculateCostToDrive();
});

function getFuelPriceClicked(sender) {
    var parentContainer = findParentContainer(sender);
    if (!parentContainer) { return; }

    var countryCode = $(parentContainer).find("select.ctd-country").first().val().trim().toUpperCase();
    var fuelID      = $(parentContainer).find("select.ctd-fuel-type").first().val().trim().toLowerCase();

    if (!countryCode) { return; }

    requestFuelPrices(countryCode, fuelID);
}

$(window).on("load", () => {
    // When we first load the page, re-apply any formatting
    $(".numeric-2").each(numericChanged);
});

//#endregion