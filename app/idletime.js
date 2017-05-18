'use strict';

const EventEmitter = require('events');
const Moment = require('moment');

var idleEvent = new EventEmitter();
var now = Moment(new Date());

var idle = false;
var idleHeavy = false;
var idleTime = 0;
var isHide = true;

var lastFireIdle = Moment(new Date());
var lastFireIdleHeavy = Moment(new Date());

var timeToIdle = 60 * 1000;
var timeToIdleHeavy = 60 * 60 * 1000;
var windowEvent = null;
var intervalCheck = 1000;

function init($windowEvent) {
    //KTODO: Depurar cuanro se reincia el init

    idle = false;
    idleHeavy = false;
    windowEvent = $windowEvent;
    idleEvent = new EventEmitter();

    if (global.sharedObj.settings_manager) {
        timeToIdle = global.sharedObj.settings_manager.getSettings().here_are_dragons.idleTime;
        timeToIdleHeavy = global.sharedObj.settings_manager.getSettings().here_are_dragons.idleTimeHeavy;
        lastFireIdle = Moment(new Date());
        lastFireIdleHeavy = Moment(new Date());
        intervalCheck = timeToIdle / 10;
    }

    windowEvent.on('SHOW', () => {
        isHide = false;
        idle = false;
        idleHeavy = false;
    });

    windowEvent.on('HIDE', () => {
        isHide = true;
        lastFireIdle = Moment(new Date());
        lastFireIdleHeavy = Moment(new Date());
    });

    setInterval(() => {
        now = Moment(new Date());

        if (isHide && now - lastFireIdle > timeToIdle) {
            lastFireIdle = Moment(new Date());
            idleEvent.emit('idle');
            console.log('idle', Moment(new Date()).format('HH:mm:ss.SSS'), idleTime);
            idle = true;
        }

        if (isHide && now - lastFireIdleHeavy > timeToIdleHeavy) {
            lastFireIdleHeavy = Moment(new Date());
            idleEvent.emit('idleHeavy');
            console.log('idleHeavy', Moment(new Date()).format('HH:mm:ss.SSS'), idleTime);
            idleHeavy = true;
        }

        if (idle) {
            idleTime += intervalCheck;
        } else {
            idleTime = 0;
        }
    }, intervalCheck);
}

module.exports.init = init;
module.exports.getIdleEvent = () => {
    return idleEvent;
};
module.exports.idle = idle;
module.exports.idleHeavy = idleHeavy;
module.exports.idleTime = idleTime;
