// Immediately open a web socket to the server
// This allows us to stream async data from web
// server to the client's page
const webSocket = new WebSocket('ws://localhost:3001', null, null, null, {rejectUnauthorized: false});
//const webSocket = new WebSocket('wss://localhost:3001', 'echo-protocol');

webSocket.onopen = (event) => {
    console.log("Web socket opened!");
    requestMakes();
}

function requestMakes() {
    let req = {
        action: "requestMakes"
    }

    webSocket.send(JSON.stringify(req));
}

function requestModels(makeID) {
    let req = {
        action: "requestModels",
        id:     makeID
    }

    webSocket.send(JSON.stringify(req));
}

function addNewMake(makeID, name) {
    let selectMake = document.getElementById("select-make");
    let newOption = document.createElement("option");
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

webSocket.onmessage = (msg) => {
    let resp = JSON.parse(msg.data);
    console.log(resp);

    switch (resp.type.trim().toLowerCase()) {
        case "make":
            addNewMake(resp.data.MakeID, resp.data.Name);
            break;

        case "model":
            addNewModel(resp.data.modelID, resp.data.Name);
            break;

        default:
            break;
    }
}

// Events for when a selection is changed
$("#select-make").on("change", (e) => {
    // Get the value of the make
    // and ensure it's non-blank
    let makeID = $(e.target).find(":selected").val().trim();
    console.log(makeID);

    if (!makeID) { return; }

    requestModels(makeID);
})