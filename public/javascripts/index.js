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
    console.log(resp);

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
            break;

        default:
            break;
    }
}

function getSelectedValue(selectNode) {
    return $(selectNode).find(":selected").val().trim();
}

// Events for when a selection is changed
$("#select-make").on("change", (e) => {
    // Get the value of the make
    // and ensure it's non-blank
    var makeID = getSelectedValue($("#select-make"));
    console.log(makeID);

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
})