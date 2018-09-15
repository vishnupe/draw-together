console.log("Hurray");
import "./assets/less/app.less";
import {
    dataChannelIncomingSubject,
    dataChannelOutgoingSubject
} from './webrtc.js';

let artBoard;
let artBoardContext;

let state = {
    myCoords: {
        oldC: null,
        oldMidC: null,
        strokeColor: '#4CAF50'
        // currentC: null
    },
    hisCoords: {
        oldC: null,
        oldMidC: null,
        strokeColor: '##ff0000'
        // currentC: null
    },
    isDrawing: false,
    isHeDrawing: false
}

const setState = (newState) => {
    state = newState;
}

const getState = () => {
    return state;
}

const drawPoint = (currentC, coords) => {
    console.log('draw');
    let {
        oldC,
        oldMidC,
    } = coords;
    let { strokeColor } = coords; 
    if (!oldC) {
        oldC = currentC;
        oldMidC = currentC;
    }
    artBoardContext.strokeStyle = strokeColor;
    let currentMidC = getMidInputCoords(currentC, oldC);
    artBoardContext.beginPath();
    artBoardContext.moveTo(currentMidC.x, currentMidC.y);
    artBoardContext.quadraticCurveTo(oldC.x, oldC.y, oldMidC.x, oldMidC.y);
    artBoardContext.stroke();
    // artBoardContext.strokeStyle = '#000000';

    oldC = currentC;
    oldMidC = currentMidC;
    return {
        oldC,
        oldMidC,
        strokeColor
    };
}

const getCanvasPosition = (canvas, x, y) => {
    let bbox = canvas.getBoundingClientRect();
    return {
        x: x - bbox.left * (canvas.width / bbox.width),
        y: y - bbox.top * (canvas.height / bbox.height)
    };
}

const getMidInputCoords = (newC, oldC) => {
    return {
        x: oldC.x + newC.x >> 1,
        y: oldC.y + newC.y >> 1
    };
}

const setupCanvas = (canvas) => {
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    var ctx = canvas.getContext('2d');
    return ctx;
}

const initialise = () => {
    artBoard = document.getElementById("art-board");
    artBoardContext = setupCanvas(artBoard);
    artBoardContext.clearRect(0, 0, artBoard.width, artBoard.height);
};



window.addEventListener("load", () => {
    console.log("Loaded");
    initialise();
    dataChannelIncomingSubject.subscribe((message) => {
        console.log('Incoming:', message);
        let parsedMessage = JSON.parse(message);
        let mousePoint = getCanvasPosition(artBoard, parsedMessage.clientX, parsedMessage.clientY);
        switch (parsedMessage.eventType) {
            case 'mousemove':
                if (getState().isHeDrawing) {
                    setState(Object.assign({}, state, {
                        hisCoords: drawPoint(mousePoint, getState().hisCoords)
                    }));
                }
                break;
            case 'mousedown':
                setState(Object.assign({}, state, {
                    isHeDrawing: true
                }));
                setState(Object.assign({}, state, {
                    hisCoords: drawPoint(mousePoint, getState().hisCoords)
                }));
                break;
            case 'mouseup':
                setState(Object.assign({}, state, {
                    isHeDrawing: false,
                    hisCoords: {
                        oldC: null,
                        oldMidC: null,
                        strokeColor: '#ff0000'
                    }
                }));
                break;
            default:
                throw ('Unsupported event type');
        }

    });
    artBoard.onmousemove = (event) => {
        dataChannelOutgoingSubject.next(JSON.stringify({
            eventType: 'mousemove',
            clientX: event.clientX,
            clientY: event.clientY
        }));
        let mousePoint = getCanvasPosition(artBoard, event.clientX, event.clientY);
        if (getState().isDrawing) {
            setState(Object.assign({}, state, {
                myCoords: drawPoint(mousePoint, getState().myCoords)
            }));
        }
    }
    artBoard.onmousedown = (event) => {
        dataChannelOutgoingSubject.next(JSON.stringify({
            eventType: 'mousedown',
            clientX: event.clientX,
            clientY: event.clientY
        }));
        let mousePoint = getCanvasPosition(artBoard, event.clientX, event.clientY);
        setState(Object.assign({}, state, {
            isDrawing: true
        }));
        setState(Object.assign({}, state, {
            myCoords: drawPoint(mousePoint, getState().myCoords)
        }));
    }
    artBoard.onmouseup = (event) => {
        dataChannelOutgoingSubject.next(JSON.stringify({
            eventType: 'mouseup',
            clientX: event.clientX,
            clientY: event.clientY
        }));
        let mousePoint = getCanvasPosition(artBoard, event.clientX, event.clientY);
        setState(Object.assign({}, state, {
            isDrawing: false,
            myCoords: {
                oldC: null,
                oldMidC: null,
                strokeColor: '#4CAF50'
            }
        }));
    }
});