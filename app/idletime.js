'use strict';

const EventEmitter = require('events');
const Moment = require('moment');
const logger = require('./main_logger.js');

let idleEvent = new EventEmitter();
let now = Moment(new Date());

let idle = false;
let idleTime = 0;
let isHide = true;

let lastFireIdle = Moment(new Date());

let timeToIdle = 60 * 1000;
let windowEvent = null;
let intervalCheck = 1000;

function init($windowEvent) {
    //KTODO: Depurar cuanro se reincia el init

    idle = false;
    windowEvent = $windowEvent;
    idleEvent = new EventEmitter();

    if (global.sharedObj.settings_manager) {
        timeToIdle = global.sharedObj.settings_manager.getSettings().here_are_dragons.idleTime;
        lastFireIdle = Moment(new Date());
        intervalCheck = timeToIdle / 10;
    }

    windowEvent.on('SHOW', () => {
        isHide = false;
        idle = false;
    });

    windowEvent.on('HIDE', () => {
        isHide = true;
        lastFireIdle = Moment(new Date());
    });

    setInterval(() => {
        now = Moment(new Date());

        if (isHide && now - lastFireIdle > timeToIdle) {
            lastFireIdle = Moment(new Date());
            idleEvent.emit('idle');
            console.log('[idle]', Moment(new Date()).format('HH:mm:ss.SSS'), idleTime);
            idle = true;
        }

        if (idle) {
            idleTime += intervalCheck;
        } else {
            idleTime = 0;
        }
    }, intervalCheck);
}

const getIdleTime = () => idleTime;

let offsetTimeCounter = 0;
let offsetTime = 10 * 1000;

const onIdleTimeInterval = function(callback, time) {
    if (!callback || !time) return;
    offsetTimeCounter++;
    let totalTime = time + offsetTime * offsetTimeCounter;
    let interval = setInterval(function() {
        if (getIdleTime() >= totalTime) {
            if (callback) {
                try {
                    callback(idle, getIdleTime());
                } catch (e) {}
            } else {
                clearInterval(interval);
            }
        }
    }, totalTime);
};

module.exports.init = init;
module.exports.getIdleEvent = () => {
    return idleEvent;
};
module.exports.idle = idle;
module.exports.getIdleTime = getIdleTime;
module.exports.onIdleTimeInterval = onIdleTimeInterval;
