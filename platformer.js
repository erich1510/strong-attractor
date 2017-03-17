let game = new Phaser.Game(width, height, Phaser.AUTO, 'gameWindow');

game.state.add('boot', {preload: boot, create: postBoot});
game.state.add('menu', {preload: loadMenu, create: createMenu});
game.state.add('main', {preload: preload, create: create, update: update, render: render});
//game.state.add('win', {preload: loadWin, create: displayWinMessage, update: backtoMenu});

game.state.start('boot');

// LOAD STATE
function boot(){
    // Load file lists here
    game.load.text('levelList', 'assets/levels/levelList.txt');
}
function postBoot(){
    // Immediately run menu once boot-loading is finished
    game.state.start('menu');
}

// MENU STATE
function loadMenu() {
    game.load.image('background', 'assets/art/MenuBackground.png');
    game.load.image('startBtn', 'assets/art/startButton.png');
    createMenu();
}

function createMenu() {
    background = game.add.sprite(405,210, 'background');
    background.anchor.set(0.5,0.5);
    background.immovable = true;
    startBtn = game.add.sprite(width/2, height/2, 'startBtn');
    startBtn.anchor.set(0.5,0.5);
    startBtn.inputEnabled = true;
    startBtn.events.onInputDown.add(function() {
        game.state.start('main');
    }, this);
}

// GAME STATE
function preload() {
    game.load.image('player', 'assets/art/player.png');
    game.load.image('exit', 'assets/art/exit.png');
    game.load.image('wall', 'assets/art/bricks_gray.png');
    game.load.image('gravObj', 'assets/art/gravObj.png');

    game.load.spritesheet('shocker', 'assets/art/electricity_sprites.png', 30, 30, 3);
    queueLevelsFromList();
}

function create() {
    game.stage.backgroundColor = '#faebd7';
    game.physics.startSystem(Phaser.Physics.ARCADE);
    game.world.enableBody = true;
    game.canvas.oncontextmenu = function (e) {
        e.preventDefault();
    };

    setupPauseButton();

    walls = game.add.group();
    gravObjects = game.add.group();
    shockers = game.add.group();
    exits = game.add.group();

    graphics = game.add.graphics();

    currentLevelNum = startingLevelNum;
    for(let i=0; i<levelCount; i++){
        levels[i]=game.cache.getText("level"+i).split('\n');
    }
    makeLevelSelector();
    loadLevel();
}


function setupPauseButton(){
    let pauseBtn = game.input.keyboard.addKey(Phaser.KeyCode.SPACEBAR);
    pauseBtn.onDown.add(function() {
        if (game.physics.arcade.isPaused) {
            pauseText.kill();
        } else {
            pauseText = game.add.text(player.body.position.x + 5, player.body.position.y - 15, "Paused", {fill: "#000"});
            pauseText.anchor.set(.5, .5);
        }
        game.physics.arcade.isPaused = ! game.physics.arcade.isPaused;
    }, this);
}

function makeLevelSelector(){

    let selector = $('#level-select');

    let atrSelected;
    for(let i = 0; i < levelCount; i++) {

        if ( i == currentLevelNum) {
            atrSelected = 'selected';
        } else {
            atrSelected = '';
        }

        selector.append('<option ' + atrSelected + ' value="' + i + '">' + i + '</option>');
    }
}

function within(a, b, delta) {
    return a <= b + delta && a >= b - delta;
}

function update() {
    game.physics.arcade.collide(player, walls, null, function (playerSprite, wallSprite) {
        let corner = false;
        if (within(playerSprite.bottom, wallSprite.top, 5) || within(playerSprite.top, wallSprite.bottom, 5)) {
            corner |= within(playerSprite.left, wallSprite.right, 2);
            corner |= within(playerSprite.right, wallSprite.left, 2);

        }
        return !corner;
    }, this);

    game.physics.arcade.collide(player, gravObjects);

    game.physics.arcade.overlap(player, shockers, restart, null, this);
    game.physics.arcade.overlap(player, exits, function() {
        currentLevelNum++;
        loadLevel();
    }, null);

    if (! game.physics.arcade.isPaused){
        if (game.input.keyboard.isDown(Phaser.KeyCode.A)) {
            if (player.body.touching.down) {
                player.body.velocity.x = Math.max(-maxHorizontalVelocity, player.body.velocity.x - groundAcceleration);
            } else {
                player.body.velocity.x -= airAcceleration;
            }
        } else if (game.input.keyboard.isDown(Phaser.KeyCode.D)) {
            if (player.body.touching.down) {
                player.body.velocity.x = Math.min(maxHorizontalVelocity, player.body.velocity.x + groundAcceleration);
            } else {
                player.body.velocity.x += airAcceleration;
            }
        } else {
            if (player.body.touching.down) {
                player.body.velocity.x = player.body.velocity.x * frictionCoef;
            }
        }

        if (game.input.keyboard.isDown(Phaser.KeyCode.W) && player.body.touching.down) {
            player.body.velocity.y = -jumpVelocity;
            jumpCount = 0;
        }
        //Let user jump higher if they hold the button down
        if (jumpCount < jumpFrames) {
            if (game.input.keyboard.isDown(Phaser.KeyCode.W)) {
                player.body.velocity.y -= jumpVelocity/(jumpFrames - 3)
            } else {
                jumpCount = jumpFrames;
            }

        }

        jumpCount += 1;
    }

    // Adjust attraction of clicked object
    if (game.input.activePointer.leftButton.isDown && clickedObj != null) {
        clickedObj.gravWeight = Math.min(clickedObj.gravMax, clickedObj.gravWeight + 5000)
    }
    if (game.input.activePointer.rightButton.isDown && clickedObj != null) {
        clickedObj.gravWeight = Math.max(clickedObj.gravMin, clickedObj.gravWeight - 5000)
    }



    let xGravCoef = 0;
    let yGravCoef = 0;

    // Gravity object changes
    for (let i = 0;  i < gravObjects.children.length; i++) {
        let gravObj = gravObjects.children[i];

        if (gravObj.gravOn) {
            let diff = Phaser.Point.subtract(player.position, gravObj.position);
            let r = diff.getMagnitude();
            diff.normalize();
            
            if ( r < (gravObj.gravWeight / gravCoef) * circleRadius) {
                xGravCoef += gravObj.gravWeight * diff.x / r;
                yGravCoef += gravObj.gravWeight * diff.y / r;
            }
        }

        if (gravObj.flux) {
            gravObj.gravWeight += 2000 * gravObj.fluxConst;
            if (gravObj.gravWeight >= gravObj.gravMax || gravObj.gravWeight <= gravObj.gravMin) {
                gravObj.fluxConst *= -1;
            }
        }

        if (gravObj.moving) {
            let loc = gravObj.body.position;
            let movementList = gravObj.movementList;
            let movementIndex = gravObj.movementIndex;
            let movingToX = movementList[movementIndex].split('#')[0] - 15;
            let movingToY = movementList[movementIndex].split('#')[1] - 15;

            if (parseInt(loc.x) == movingToX && parseInt(loc.y) == movingToY) {
                gravObj.movementIndex = (movementIndex + 1) % movementList.length;
            } else {
                gravObj.body.velocity.x = (loc.x < movingToX) * 30 - (loc.x > movingToX) * 30;
                gravObj.body.velocity.y = (loc.y < movingToY) * 30 - (loc.y > movingToY) * 30;
            }
        }
    }
    player.body.acceleration.x = -xGravCoef;
    player.body.acceleration.y = -yGravCoef;
}

function render() {
    let drawGravObjCircle = function(gravObj) {
        // these are heuristic constants which look okay
        if (gravObj.gravOn) {
            let radius = (gravObj.gravWeight / gravCoef) * (circleRadius * 2);
            let subAmount = 50;
            let alpha = 0.1;
            let fillColor = gravObj.gravOn ? gravObjColor : 0x808080;
            while (radius > 0) {
                graphics.beginFill(fillColor, alpha);
                graphics.drawCircle(gravObj.x, gravObj.y, radius);
                graphics.endFill();
                radius -= subAmount;
            }
        }
    };
    graphics.clear();
    for (let i = 0; i < gravObjects.children.length; i++) {
        drawGravObjCircle(gravObjects.children[i]);
    }
}


function restart() {

    // Reload player
    if (player != undefined)
        player.kill();
    player = game.add.sprite(player_startX, player_startY, 'player');
    player.anchor.set(.5, .5);
    player.body.gravity.y = gravCoef / 60;
    game.camera.follow(player);

    // Reset any pick-ups or similar here
}

function initializeGravObj(x, y, gravMin, gravMax, gravOn, flux, moving, movementList) {
    let gravObj = game.add.sprite(x, y, 'gravObj');
    gravObj.anchor.set(.5, .5);
    gravObj.gravOn = true ;
    gravObj.gravWeight = ((gravMin + gravMax)/2) * gravOn * (1 - flux);
    gravObj.gravMin = gravMin;
    gravObj.gravMax = gravMax;
    gravObjects.add(gravObj);
    gravObj.body.immovable = true;
    gravObj.inputEnabled = true;
    gravObj.flux = flux;
    gravObj.moving = moving;
    gravObj.movementList = movementList;
    gravObj.movementIndex = 0;
    if (! flux && ! moving) {
        gravObj.events.onInputDown.add(startGravityClick, this);
        gravObj.events.onInputUp.add(function() {
            clickedObj = null;
        }, this);
    } else if(flux) {
        gravObj.fluxConst = 1;
    }
    // TODO: make new grav obj sprite
    gravObj.tint = gravObjColor;
}

function startGravityClick(gravObj) {

    if (game.input.activePointer.rightButton.isDown) {
        if (! gravObj.secondClick) {
            gravObj.secondClick = true;
            game.time.events.add(300, function() {
                gravObj.secondClick = false;
            }, this);

        } else {
            gravObj.gravWeight = 0;
        }
    }

    clickedObj = gravObj;
}

// WIN STATE
