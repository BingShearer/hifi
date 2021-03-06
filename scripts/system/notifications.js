//
//  notifications.js
//  Version 0.801
//  Created by Adrian
//
//  Adrian McCarlie 8-10-14
//  This script demonstrates on-screen overlay type notifications.
//  Copyright 2014 High Fidelity, Inc.
//
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html

//  This script generates notifications created via a number of ways, such as:
//  keystroke:
//
//  CTRL/s for snapshot.
//  CTRL/m for mic mute and unmute.

//  System generated notifications:
//  If Screen is resized.
//  If mic is muted for any reason.
//
//  To add a new System notification type:
//
//  1. Set the Event Connector at the bottom of the script.
//  example:
//  AudioDevice.muteToggled.connect(onMuteStateChanged);
//
//  2. Create a new function to produce a text string, do not include new line returns.
//  example:
//  function onMuteStateChanged() {
//     var muteState,
//         muteString;
//
//     muteState = AudioDevice.getMuted() ? "muted" : "unmuted";
//     muteString = "Microphone is now " + muteState;
//     createNotification(muteString, NotificationType.MUTE_TOGGLE);
//  }
//
//  This new function must call wordWrap(text) if the length of message is longer than 42 chars or unknown.
//  wordWrap() will format the text to fit the notifications overlay and return it
//  after that we will send it to createNotification(text).
//  If the message is 42 chars or less you should bypass wordWrap() and call createNotification() directly.

//  To add a keypress driven notification:
//
//  1. Add a key to the keyPressEvent(key).
//  2. Declare a text string.
//  3. Call createNotifications(text, NotificationType) parsing the text.
//  example:
//  if (key.text === "s") {
//      if (ctrlIsPressed === true) {
//          noteString = "Snapshot taken.";
//          createNotification(noteString, NotificationType.SNAPSHOT);
//      }
//  }

Script.include("./libraries/soundArray.js");

var width = 340.0; //width of notification overlay
var windowDimensions = Controller.getViewportDimensions(); // get the size of the interface window
var overlayLocationX = (windowDimensions.x - (width + 20.0)); // positions window 20px from the right of the interface window
var buttonLocationX = overlayLocationX + (width - 28.0);
var locationY = 20.0; // position down from top of interface window
var topMargin = 13.0;
var leftMargin = 10.0;
var textColor =  { red: 228, green: 228, blue: 228}; // text color
var backColor =  { red: 2, green: 2, blue: 2}; // background color was 38,38,38
var backgroundAlpha = 0;
var fontSize = 12.0;
var PERSIST_TIME_2D = 10.0;  // Time in seconds before notification fades
var PERSIST_TIME_3D = 15.0;
var persistTime = PERSIST_TIME_2D;
var clickedText = false;
var frame = 0;
var ourWidth = Window.innerWidth;
var ourHeight = Window.innerHeight;
var text = "placeholder";
var ctrlIsPressed = false;
var ready = true;
var MENU_NAME = 'Tools > Notifications';
var PLAY_NOTIFICATION_SOUNDS_MENU_ITEM = "Play Notification Sounds";
var NOTIFICATION_MENU_ITEM_POST = " Notifications";
var PLAY_NOTIFICATION_SOUNDS_SETTING = "play_notification_sounds";
var PLAY_NOTIFICATION_SOUNDS_TYPE_SETTING_PRE = "play_notification_sounds_type_";
var lodTextID = false;

var NotificationType = {
    UNKNOWN: 0,
    MUTE_TOGGLE: 1,
    SNAPSHOT: 2,
    WINDOW_RESIZE: 3,
    LOD_WARNING: 4,
    CONNECTION_REFUSED: 5,
    properties: [
        { text: "Mute Toggle" },
        { text: "Snapshot" },
        { text: "Window Resize" },
        { text: "Level of Detail" },
        { text: "Connection Refused" }
    ],
    getTypeFromMenuItem: function(menuItemName) {
        if (menuItemName.substr(menuItemName.length - NOTIFICATION_MENU_ITEM_POST.length) !== NOTIFICATION_MENU_ITEM_POST) {
            return NotificationType.UNKNOWN;
        }
        var preMenuItemName = menuItemName.substr(0, menuItemName.length - NOTIFICATION_MENU_ITEM_POST.length);
        for (type in this.properties) {
            if (this.properties[type].text === preMenuItemName) {
                return parseInt(type) + 1;
            }
        }
        return NotificationType.UNKNOWN;
    },
    getMenuString: function(type) {
        return this.properties[type - 1].text + NOTIFICATION_MENU_ITEM_POST;
    }
};

var randomSounds = new SoundArray({ localOnly: true }, true);
var numberOfSounds = 2;
for (var i = 1; i <= numberOfSounds; i++) {
    
    randomSounds.addSound(Script.resolvePath("assets/sounds/notification-general"+ i + ".raw"));
}

var notifications = [];
var buttons = [];
var times = [];
var heights = [];
var myAlpha = [];
var arrays = [];
var isOnHMD = false,
    NOTIFICATIONS_3D_DIRECTION = 0.0,  // Degrees from avatar orientation.
    NOTIFICATIONS_3D_DISTANCE = 0.6,  // Horizontal distance from avatar position.
    NOTIFICATIONS_3D_ELEVATION = -0.8,  // Height of top middle of top notification relative to avatar eyes.
    NOTIFICATIONS_3D_YAW = 0.0,  // Degrees relative to notifications direction.
    NOTIFICATIONS_3D_PITCH = -60.0,  // Degrees from vertical.
    NOTIFICATION_3D_SCALE = 0.002,  // Multiplier that converts 2D overlay dimensions to 3D overlay dimensions.
    NOTIFICATION_3D_BUTTON_WIDTH = 40 * NOTIFICATION_3D_SCALE,  // Need a little more room for button in 3D.
    overlay3DDetails = [];

//  push data from above to the 2 dimensional array
function createArrays(notice, button, createTime, height, myAlpha) {
    arrays.push([notice, button, createTime, height, myAlpha]);
}

//  This handles the final dismissal of a notification after fading
function dismiss(firstNoteOut, firstButOut, firstOut) {
    if (firstNoteOut == lodTextID) {
        lodTextID = false;
    }

    Overlays.deleteOverlay(firstNoteOut);
    Overlays.deleteOverlay(firstButOut);
    notifications.splice(firstOut, 1);
    buttons.splice(firstOut, 1);
    times.splice(firstOut, 1);
    heights.splice(firstOut, 1);
    myAlpha.splice(firstOut, 1);
    overlay3DDetails.splice(firstOut, 1);
}

function fadeIn(noticeIn, buttonIn) {
    var q = 0,
        qFade,
        pauseTimer = null;

    pauseTimer = Script.setInterval(function () {
        q += 1;
        qFade = q / 10.0;
        Overlays.editOverlay(noticeIn, { alpha: qFade });
        Overlays.editOverlay(buttonIn, { alpha: qFade });
        if (q >= 9.0) {
            Script.clearInterval(pauseTimer);
        }
    }, 10);
}

//  this fades the notification ready for dismissal, and removes it from the arrays
function fadeOut(noticeOut, buttonOut, arraysOut) {
    var r = 9.0,
        rFade,
        pauseTimer = null;

    pauseTimer = Script.setInterval(function () {
        r -= 1;
        rFade = r / 10.0;
        Overlays.editOverlay(noticeOut, { alpha: rFade });
        Overlays.editOverlay(buttonOut, { alpha: rFade });
        if (r < 0) {
            dismiss(noticeOut, buttonOut, arraysOut);
            arrays.splice(arraysOut, 1);
            ready = true;
            Script.clearInterval(pauseTimer);
        }
    }, 20);
}

function calculate3DOverlayPositions(noticeWidth, noticeHeight, y) {
    // Calculates overlay positions and orientations in avatar coordinates.
    var noticeY,
        originOffset,
        notificationOrientation,
        notificationPosition,
        buttonPosition;

    // Notification plane positions
    noticeY = -y * NOTIFICATION_3D_SCALE - noticeHeight / 2;
    notificationPosition = { x: 0, y: noticeY, z: 0 };
    buttonPosition = { x: (noticeWidth - NOTIFICATION_3D_BUTTON_WIDTH) / 2, y: noticeY, z: 0.001 };

    // Rotate plane
    notificationOrientation = Quat.fromPitchYawRollDegrees(NOTIFICATIONS_3D_PITCH,
        NOTIFICATIONS_3D_DIRECTION + NOTIFICATIONS_3D_YAW, 0);
    notificationPosition = Vec3.multiplyQbyV(notificationOrientation, notificationPosition);
    buttonPosition = Vec3.multiplyQbyV(notificationOrientation, buttonPosition);

    // Translate plane
    originOffset = Vec3.multiplyQbyV(Quat.fromPitchYawRollDegrees(0, NOTIFICATIONS_3D_DIRECTION, 0),
        { x: 0, y: 0, z: -NOTIFICATIONS_3D_DISTANCE });
    originOffset.y += NOTIFICATIONS_3D_ELEVATION;
    notificationPosition = Vec3.sum(originOffset, notificationPosition);
    buttonPosition = Vec3.sum(originOffset, buttonPosition);

    return {
        notificationOrientation: notificationOrientation,
        notificationPosition: notificationPosition,
        buttonPosition: buttonPosition
    };
}

//  Pushes data to each array and sets up data for 2nd dimension array 
//  to handle auxiliary data not carried by the overlay class
//  specifically notification "heights", "times" of creation, and . 
function notify(notice, button, height) {
    var noticeWidth,
        noticeHeight,
        positions,
        last;

    if (isOnHMD) {
        // Calculate 3D values from 2D overlay properties.

        noticeWidth = notice.width * NOTIFICATION_3D_SCALE + NOTIFICATION_3D_BUTTON_WIDTH;
        noticeHeight = notice.height * NOTIFICATION_3D_SCALE;

        notice.size = { x: noticeWidth, y: noticeHeight };
        notice.topMargin = 0.75 * notice.topMargin * NOTIFICATION_3D_SCALE;
        notice.leftMargin = 2 * notice.leftMargin * NOTIFICATION_3D_SCALE;
        notice.bottomMargin = 0;
        notice.rightMargin = 0;
        notice.lineHeight = 10.0 * (fontSize / 12.0) * NOTIFICATION_3D_SCALE;
        notice.isFacingAvatar = false;

        button.url = button.imageURL;
        button.scale = button.width * NOTIFICATION_3D_SCALE;
        button.isFacingAvatar = false;

        positions = calculate3DOverlayPositions(noticeWidth, noticeHeight, notice.y);

        notifications.push((Overlays.addOverlay("text3d", notice)));
        buttons.push((Overlays.addOverlay("image3d", button)));
        overlay3DDetails.push({
            notificationOrientation: positions.notificationOrientation,
            notificationPosition: positions.notificationPosition,
            buttonPosition: positions.buttonPosition,
            width: noticeWidth,
            height: noticeHeight
        });
    } else {
        var notificationText = Overlays.addOverlay("text", notice);
        notifications.push((notificationText));
        buttons.push((Overlays.addOverlay("image", button)));
    }

    height = height + 1.0;
    heights.push(height);
    times.push(new Date().getTime() / 1000);
    myAlpha.push(0);
    last = notifications.length - 1;
    createArrays(notifications[last], buttons[last], times[last], heights[last], myAlpha[last]);
    fadeIn(notifications[last], buttons[last]);
    return notificationText;
}

//  This function creates and sizes the overlays
function createNotification(text, notificationType) {
    var count = (text.match(/\n/g) || []).length,
        breakPoint = 43.0, // length when new line is added
        extraLine = 0,
        breaks = 0,
        height = 40.0,
        stack = 0,
        level,
        noticeProperties,
        bLevel,
        buttonProperties,
        i;

    if (text.length >= breakPoint) {
        breaks = count;
    }
    extraLine = breaks * 16.0;
    for (i = 0; i < heights.length; i += 1) {
        stack = stack + heights[i];
    }

    level = (stack + 20.0);
    height = height + extraLine;
    noticeProperties = {
        x: overlayLocationX,
        y: level,
        width: width,
        height: height,
        color: textColor,
        backgroundColor: backColor,
        alpha: backgroundAlpha,
        topMargin: topMargin,
        leftMargin: leftMargin,
        font: {size: fontSize},
        text: text
    };

    bLevel = level + 12.0;
    buttonProperties = {
        x: buttonLocationX,
        y: bLevel,
        width: 10.0,
        height: 10.0,
        subImage: { x: 0, y: 0, width: 10, height: 10 },
        imageURL: Script.resolvePath("assets/images/close-small-light.svg"),
        color: { red: 255, green: 255, blue: 255},
        visible: true,
        alpha: backgroundAlpha
    };

    if (Menu.isOptionChecked(PLAY_NOTIFICATION_SOUNDS_MENU_ITEM) &&
        Menu.isOptionChecked(NotificationType.getMenuString(notificationType)))
    {
        randomSounds.playRandom();
    }

    return notify(noticeProperties, buttonProperties, height);
}

function deleteNotification(index) {
    var notificationTextID = notifications[index];
    if (notificationTextID == lodTextID) {
        lodTextID = false;
    }
    Overlays.deleteOverlay(notificationTextID);
    Overlays.deleteOverlay(buttons[index]);
    notifications.splice(index, 1);
    buttons.splice(index, 1);
    times.splice(index, 1);
    heights.splice(index, 1);
    myAlpha.splice(index, 1);
    overlay3DDetails.splice(index, 1);
    arrays.splice(index, 1);
}

//  wraps whole word to newline
function stringDivider(str, slotWidth, spaceReplacer) {
    var p,
        left,
        right;

    if (str.length > slotWidth) {
        p = slotWidth;
        while (p > 0 && str[p] !== ' ') {
            p -= 1;
        }

        if (p > 0) {
            left = str.substring(0, p);
            right = str.substring(p + 1);
            return left + spaceReplacer + stringDivider(right, slotWidth, spaceReplacer);
        }
    }
    return str;
}

//  formats string to add newline every 43 chars
function wordWrap(str) {
    return stringDivider(str, 43.0, "\n");
}

//  This fires a notification on window resize
function checkSize() {
    if ((Window.innerWidth !== ourWidth) || (Window.innerHeight !== ourHeight)) {
        var windowResize = "Window has been resized";
        ourWidth = Window.innerWidth;
        ourHeight = Window.innerHeight;
        windowDimensions = Controller.getViewportDimensions();
        overlayLocationX = (windowDimensions.x - (width + 60.0));
        buttonLocationX = overlayLocationX + (width - 35.0);
        createNotification(windowResize, NotificationType.WINDOW_RESIZE);
    }
}

function update() {
    var nextOverlay,
        noticeOut,
        buttonOut,
        arraysOut,
        defaultEyePosition,
        avatarOrientation,
        notificationPosition,
        notificationOrientation,
        buttonPosition,
        positions,
        i,
        j,
        k;

    if (isOnHMD !== HMD.active) {
        while (arrays.length > 0) {
            deleteNotification(0);
        }
        isOnHMD = !isOnHMD;
        persistTime = isOnHMD ? PERSIST_TIME_3D : PERSIST_TIME_2D;
        return;
    }

    frame += 1;
    if ((frame % 60.0) === 0) { // only update once a second
        checkSize(); // checks for size change to trigger windowResize notification
        locationY = 20.0;
        for (i = 0; i < arrays.length; i += 1) { //repositions overlays as others fade
            nextOverlay = Overlays.getOverlayAtPoint({ x: overlayLocationX, y: locationY });
            Overlays.editOverlay(notifications[i], { x: overlayLocationX, y: locationY });
            Overlays.editOverlay(buttons[i], { x: buttonLocationX, y: locationY + 12.0 });
            if (isOnHMD) {
                positions = calculate3DOverlayPositions(overlay3DDetails[i].width, overlay3DDetails[i].height, locationY);
                overlay3DDetails[i].notificationOrientation = positions.notificationOrientation;
                overlay3DDetails[i].notificationPosition = positions.notificationPosition;
                overlay3DDetails[i].buttonPosition = positions.buttonPosition;
            }
            locationY = locationY + arrays[i][3];
        }
    }

    //  This checks the age of the notification and prepares to fade it after 9.0 seconds (var persistTime - 1)
    for (i = 0; i < arrays.length; i += 1) {
        if (ready) {
            j = arrays[i][2];
            k = j + persistTime;
            if (k < (new Date().getTime() / 1000)) {
                ready = false;
                noticeOut = arrays[i][0];
                buttonOut = arrays[i][1];
                arraysOut = i;
                fadeOut(noticeOut, buttonOut, arraysOut);
            }
        }
    }

    if (isOnHMD && notifications.length > 0) {
        // Update 3D overlays to maintain positions relative to avatar
        defaultEyePosition = MyAvatar.getDefaultEyePosition();
        avatarOrientation = MyAvatar.orientation;

        for (i = 0; i < notifications.length; i += 1) {
            notificationPosition = Vec3.sum(defaultEyePosition,
                Vec3.multiplyQbyV(avatarOrientation, overlay3DDetails[i].notificationPosition));
            notificationOrientation = Quat.multiply(avatarOrientation, overlay3DDetails[i].notificationOrientation);
            buttonPosition = Vec3.sum(defaultEyePosition,
                Vec3.multiplyQbyV(avatarOrientation, overlay3DDetails[i].buttonPosition));
            Overlays.editOverlay(notifications[i], { position: notificationPosition, rotation: notificationOrientation });
            Overlays.editOverlay(buttons[i], { position: buttonPosition, rotation: notificationOrientation });
        }
    }
}

var STARTUP_TIMEOUT = 500,  // ms
    startingUp = true,
    startupTimer = null;

function finishStartup() {
    startingUp = false;
    Script.clearTimeout(startupTimer);
}

function isStartingUp() {
    // Is starting up until get no checks that it is starting up for STARTUP_TIMEOUT
    if (startingUp) {
        if (startupTimer) {
            Script.clearTimeout(startupTimer);
        }
        startupTimer = Script.setTimeout(finishStartup, STARTUP_TIMEOUT);
    }
    return startingUp;
}

//  Triggers mic mute notification
function onMuteStateChanged() {
    var muteState,
        muteString;

    muteState = AudioDevice.getMuted() ? "muted" : "unmuted";
    muteString = "Microphone is now " + muteState;
    createNotification(muteString, NotificationType.MUTE_TOGGLE);
}

function onDomainConnectionRefused(reason) {
    createNotification("Connection refused: " + reason, NotificationType.CONNECTION_REFUSED );
}

//  handles mouse clicks on buttons
function mousePressEvent(event) {
    var pickRay,
        clickedOverlay,
        i;

    if (isOnHMD) {
        pickRay = Camera.computePickRay(event.x, event.y);
        clickedOverlay = Overlays.findRayIntersection(pickRay).overlayID;
    } else {
        clickedOverlay = Overlays.getOverlayAtPoint({ x: event.x, y: event.y });
    }

    for (i = 0; i < buttons.length; i += 1) {
        if (clickedOverlay === buttons[i]) {
            deleteNotification(i);
        }
    }
}

//  Control key remains active only while key is held down
function keyReleaseEvent(key) {
    if (key.key === 16777249) {
        ctrlIsPressed = false;
    }
}

//  Triggers notification on specific key driven events
function keyPressEvent(key) {
    var noteString;

    if (key.key === 16777249) {
        ctrlIsPressed = true;
    }

    if (key.text === "s") {
        if (ctrlIsPressed === true) {
            noteString = "Snapshot taken.";
            createNotification(noteString, NotificationType.SNAPSHOT);
        }
    }
}

function setup() {
    Menu.addMenu(MENU_NAME);
    var checked = Settings.getValue(PLAY_NOTIFICATION_SOUNDS_SETTING);
    checked = checked === '' ? true : checked;
    Menu.addMenuItem({
        menuName: MENU_NAME,
        menuItemName: PLAY_NOTIFICATION_SOUNDS_MENU_ITEM,
        isCheckable: true,
        isChecked: Settings.getValue(PLAY_NOTIFICATION_SOUNDS_SETTING)
    });
    Menu.addSeparator(MENU_NAME, "Play sounds for:");
    for (type in NotificationType.properties) {
        checked = Settings.getValue(PLAY_NOTIFICATION_SOUNDS_TYPE_SETTING_PRE + (parseInt(type) + 1));
        checked = checked === '' ? true : checked;
        Menu.addMenuItem({
            menuName: MENU_NAME,
            menuItemName: NotificationType.properties[type].text + NOTIFICATION_MENU_ITEM_POST,
            isCheckable: true,
            isChecked: checked
        });
    }
}

//  When our script shuts down, we should clean up all of our overlays
function scriptEnding() {
    for (var i = 0; i < notifications.length; i++) {
        Overlays.deleteOverlay(notifications[i]);
        Overlays.deleteOverlay(buttons[i]);
    }
    Menu.removeMenu(MENU_NAME);
}

function menuItemEvent(menuItem) {
    if (menuItem === PLAY_NOTIFICATION_SOUNDS_MENU_ITEM) {
        Settings.setValue(PLAY_NOTIFICATION_SOUNDS_SETTING, Menu.isOptionChecked(PLAY_NOTIFICATION_SOUNDS_MENU_ITEM));
        return;
    }
    var notificationType = NotificationType.getTypeFromMenuItem(menuItem);
    if (notificationType !== notificationType.UNKNOWN) {
        Settings.setValue(PLAY_NOTIFICATION_SOUNDS_TYPE_SETTING_PRE + notificationType, Menu.isOptionChecked(menuItem));
    }
}

LODManager.LODDecreased.connect(function() {
    var warningText = "\n"
            + "Due to the complexity of the content, the \n"
            + "level of detail has been decreased. "
            + "You can now see: \n" 
            + LODManager.getLODFeedbackText();

    if (lodTextID == false) {
        lodTextID = createNotification(warningText, NotificationType.LOD_WARNING);
    } else {
        Overlays.editOverlay(lodTextID, { text: warningText });
    }
});

AudioDevice.muteToggled.connect(onMuteStateChanged);
Controller.keyPressEvent.connect(keyPressEvent);
Controller.mousePressEvent.connect(mousePressEvent);
Controller.keyReleaseEvent.connect(keyReleaseEvent);
Script.update.connect(update);
Script.scriptEnding.connect(scriptEnding);
Menu.menuItemEvent.connect(menuItemEvent);
Window.domainConnectionRefused.connect(onDomainConnectionRefused);

setup();
