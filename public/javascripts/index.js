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
    var req = {
        action: "requestMakes"
    }

    webSocket.send(JSON.stringify(req));
}

function requestModels(makeID) {

}

webSocket.onmessage = (msg) => {
    var resp = JSON.parse(msg.data);

    if (resp.type == "make") {
        var selectMake = document.getElementById("select-make");
        var newOption = document.createElement("option");
        newOption.value = resp.data.MakeID;
        newOption.text  = resp.data.Name;
        selectMake.appendChild(newOption);
    }
}