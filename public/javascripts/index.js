// Immediately open a web socket to the server
// This allows us to stream async data from web
// server to the client's page
const webSocket = new WebSocket('ws://localhost:3001', null, null, null, {rejectUnauthorized: false});
//const webSocket = new WebSocket('wss://localhost:3001', 'echo-protocol');

webSocket.onopen = (event) => {
    console.log("Web socket opened!");
    requestMakes();
}

//// Session Variables ////
let avgUrbanKMPL    = 0.0;
let avgMotorwayKMPL = 0.0;
let lastFuelEconomyUnit = "";

function getSelectedValue(selectNode) {
    return $(selectNode).find(":selected").val().trim();
}

function getSelectedFuelEconomyUnit() {
    return $("#select-fuel-eco-unit").find(":selected").val().trim().toLowerCase();
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

}

function convertCurrency(curValue, curUnit, newUnit) {
    // We might need to fetch this price externally...
    // but for now let's just settle on arbitrary values

}

function updateFuelEco(newValue) {
    if (!newValue) {
        newValue = Number($("#input-fuel-eco").val());
    }

    $("#input-fuel-eco").val(convertFuelEco(newValue, lastFuelEconomyUnit, getSelectedFuelEconomyUnit()).toFixed(2));
}

//// REQUEST FUNCTIONS ////
function requestMakes() {
    let req = {
        action: "requestMakes"
    }

    webSocket.send(JSON.stringify(req));
}

function requestModels(makeID) {
    let req = {
        action: "requestModels",
        makeID:     makeID
    }

    webSocket.send(JSON.stringify(req));
}

function requestYears(makeID, modelID) {
    let req = {
        action:  "requestYears",
        makeID:  makeID,
        modelID: modelID
    }

    webSocket.send(JSON.stringify(req));
}

function requestFuelTypes(makeID, modelID, year) {
    let req = {
        action:  "requestFuelTypes",
        makeID:  makeID,
        modelID: modelID,
        year:    year
    }

    webSocket.send(JSON.stringify(req));
}

function requestEngineSizes(makeID, modelID, year, fuelTypeID) {
    let req = {
        action:     "requestEngineSizes",
        makeID:     makeID,
        modelID:    modelID,
        year:       year,
        fuelTypeID: fuelTypeID
    }

    webSocket.send(JSON.stringify(req));
}

function requestFuelEconomies(makeID, modelID, year, fuelTypeID, engineSize) {
    let req = {
        action:     "requestFuelEconomies",
        makeID:     makeID,
        modelID:    modelID,
        year:       year,
        fuelTypeID: fuelTypeID,
        engineSize: engineSize
    }

    webSocket.send(JSON.stringify(req));
}


//// RESPONSE FUNCTIONS ////
function addNewMake(makeID, name) {
    let selectMake  = document.getElementById("select-make");
    let newOption   = document.createElement("option");
    newOption.value = makeID;
    newOption.text  = name;

    selectMake.appendChild(newOption);
}

function addNewModel(modelID, name) {
    let selectModel = document.getElementById("select-model");
    let newOption   = document.createElement("option");
    newOption.value = modelID;
    newOption.text  = name;

    selectModel.appendChild(newOption);
}

function addNewYear(year) {
    var selectYear  = document.getElementById("select-year");
    var newOption   = document.createElement("option");
    newOption.value = year;
    newOption.text  = year;

    selectYear.appendChild(newOption);
}

function addNewFuelType(fuelTypeID, description) {
    var selectFuelType = document.getElementById("select-fuel-type");
    var newOption      = document.createElement("option");
    newOption.value    = fuelTypeID;
    newOption.text     = description;

    selectFuelType.appendChild(newOption);
}

function addNewEngineSize(engineSize) {
    var selectEngineSize = document.getElementById("select-engine-size");
    var newOption        = document.createElement("option");
    newOption.value      = engineSize;
    newOption.text       = engineSize.toFixed(1);

    selectEngineSize.appendChild(newOption);
}

//// CLEAR OPTIONS ////
// Defined last parameter first
// then each subsequent function
// will call the previously
// defined function
function clearEngineSizeOptions() {
    var selectEngineSize = $("#select-engine-size");
    selectEngineSize.empty();
    selectEngineSize.append("<option value='' selected>Select an Engine Size</option>");
}

function clearFuelTypeOptions() {
    clearEngineSizeOptions();

    var selectFuelType = $("#select-fuel-type");
    selectFuelType.empty();
    selectFuelType.append("<option value='' selected>Select a Fuel Type</option>");
}

function clearYearOptions() {
    clearFuelTypeOptions();

    var selectYear = $("#select-year");
    selectYear.empty();
    selectYear.append("<option value='' selected>Select a Year</option>")
}

function clearModelOptions() {
    clearYearOptions();

    var selectModel = $("#select-model");
    selectModel.empty();
    selectModel.append("<option value='' selected>Select a Model</option>");
}

function clearMakeOptions() {
    clearModelOptions();
    
    var selectMake = $("#select-make");
    selectMake.empty();
    selectMake.append("<option value='' selected>Select a Make</option>")
}

//// INCOMING WEBSOCKETS ////
webSocket.onmessage = (msg) => {
    let resp = JSON.parse(msg.data);

    switch (resp.type.trim().toLowerCase()) {
        case "make":
            addNewMake(Number(resp.data.MakeID), resp.data.Name);
            break;

        case "model":
            addNewModel(Number(resp.data.ModelID), resp.data.Name);
            break;

        case "year":
            addNewYear(Number(resp.data.Year));
            break;

        case "fueltype":
            addNewFuelType(Number(resp.data.FuelTypeID), resp.data.Description);
            break;

        case "enginesize":
            addNewEngineSize(Number(resp.data.EngineSize));
            break;

        case "fueleconomy":
            avgUrbanKMPL    = Number(resp.data.AvgUrbanKMPL);
            avgMotorwayKMPL = Number(resp.data.AvgMotorwayKMPL);
            // Manually trigger the "change" event so we can
            // calculate the eco
            $("#input-driving-style").trigger("change");
            break;

        default:
            break;
    }
}

// Events for when a selection is changed
$("#select-make").on("change", (e) => {
    // Get the value of the make
    // and ensure it's non-blank
    var makeID = getSelectedValue($("#select-make"));

    if (!makeID) { return; }

    clearModelOptions();
    requestModels(makeID);
});

$("#select-model").on("change", (e) => {
    var makeID = getSelectedValue($("#select-make"));
    var modelID = getSelectedValue($("#select-model"));

    if (!makeID || !modelID) { return; }

    clearYearOptions();
    requestYears(makeID, modelID);
});

$("#select-year").on("change", (e) => {
    var makeID  = getSelectedValue($("#select-make"));
    var modelID = getSelectedValue($("#select-model"));
    var year    = getSelectedValue($("#select-year"));

    if (!makeID || !modelID || !year) {
        return;
    }

    clearFuelTypeOptions();
    requestFuelTypes(makeID, modelID, year);
});

$("#select-fuel-type").on("change", (e) => {
    var makeID     = getSelectedValue($("#select-make"));
    var modelID    = getSelectedValue($("#select-model"));
    var year       = getSelectedValue($("#select-year"));
    var fuelTypeID = getSelectedValue($("#select-fuel-type"));

    if (!makeID || !modelID || !year || !fuelTypeID) {
        return;
    }

    clearEngineSizeOptions();
    requestEngineSizes(makeID, modelID, year, fuelTypeID)
})

// Once an engine size is selected we need 
// to get the average fuel eco for city and
// for motorway driving. The slider will be
// a range of 0% to 100% in terms of how much
// driving is on the motorway
$("#select-engine-size").on("change", (e) => {
    var makeID     = getSelectedValue($("#select-make"));
    var modelID    = getSelectedValue($("#select-model"));
    var year       = getSelectedValue($("#select-year"));
    var fuelTypeID = getSelectedValue($("#select-fuel-type"));
    var engineSize = getSelectedValue($("#select-engine-size"));

    if (!makeID || !modelID || !year || !fuelTypeID || !engineSize) {
        return;
    }

    requestFuelEconomies(makeID, modelID, year, fuelTypeID, engineSize);
});

// Whenever the driving style range changes
// we need to recalculate the fuel economy
$("#input-driving-style").on("change", (e) => {
    // Interpolate between urban and motorway driving
    var economyDifference   = Math.abs(avgMotorwayKMPL - avgUrbanKMPL);
    var drivingStylePercent = Number($("#input-driving-style").val()) / 100.00;
    var expectedEconomy = 1;

    if (avgMotorwayKMPL > avgUrbanKMPL) {
        expectedEconomy = avgUrbanKMPL    + (economyDifference * drivingStylePercent);
    } else {
        expectedEconomy = avgMotorwayKMPL + (economyDifference * drivingStylePercent);
    }

    expectedEconomy = convertFuelEco(expectedEconomy, 'kmpl', getSelectedFuelEconomyUnit());

    updateFuelEco(expectedEconomy);
});

// Recalculate if we changed unit of measurement
$("#select-fuel-eco-unit").on("change", (e) => {
    var unitOfMeasurement = getSelectedFuelEconomyUnit();

    if (unitOfMeasurement === lastFuelEconomyUnit) { return; }

    updateFuelEco();
    
    lastFuelEconomyUnit = unitOfMeasurement;
});

// Store the original value when we focus on the field
$(".numeric-2").on("focusin", function (e) {
    $(this).data("previous-value", $(this).val());
});

// Format any fields that are "Numeric" to look like numbers
$(".numeric-2").on("keydown", function (e) {
    //console.log("keydown: " + e.keyCode + " => " + String.fromCharCode(e.keyCode));

    if (e.ctrlKey)  { return; }
    if (e.shiftKey) { return; }

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

    if (curValue.indexOf(".") > 0 && e.keyCode == 190) {
        e.preventDefault();
    }
});

// Recalculate cost if any of these fields change
$(".calc-cost").on("change", function(e) {
    var fuelPrice   = $("#input-fuel-price").val();
    var distance    = $("#input-distance").val();
    var fuelEconomy = $("#input-fuel-eco").val();

    // Convert values into common units:
    // 1. Distance     -> Kilometres
    // 2. Fuel Economy -> Kilometres per Litre
    console.log("Calculating cost!");
});

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
    newValue = newValue.replaceAll(",", "");

    if (!isNaN(newValue) && !isNaN(parseFloat(newValue))) {
        // Number is good, let's convert and format
        var numberFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        newValue = numberFormat.format(newValue);

        $(this).val(newValue);
        return;
    }

    // Fall back to previous value
    $(this).val(previousValue);
}

//$(".numeric-2").on("focusout", numericChanged);
$(".numeric-2").each( function() {
    $(this).on("change", numericChanged);
});

$(window).on("load", () => {
    lastFuelEconomyUnit = getSelectedFuelEconomyUnit();
});