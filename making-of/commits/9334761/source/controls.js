/**
 * Sets up and supports the controls in the top left of the screen. This currently includes:
 *    - A debug toggle button.
 *    - A blob refresh button.
 *    - A gravity control.
 *
 * The gravity control button is the most intricate as it work with mouse up, down and drag events.
 * It also responds to clicks for enabling and disabling.
 *
 * @param {Object} options An object literal with the following properties:
 *     - {Experiment} experiment The experiment that these controls are bound to.
 *     - {debugEl} Element The dom element for the debug toggle button.
 *     - {resetEl} Element The dom element for the reset button.
 *     - {gravityEl} Element The dom element for the gravity control button.
 */
var Controls = function(options){
    this.experiment_ = options.experiment;

    this.debugEl_ = options.debugEl;
    this.debugEl_.addEventListener('click', this.toggleRenderMode_.bind(this));

    this.resetEl_ = options.resetEl;
    this.resetEl_.addEventListener('click', this.resetButtonClicked_.bind(this));

    this.gravityEl_ = options.gravityEl;
    this.gravityArrow_ = this.gravityEl_.querySelector('.arrow');
    this.updateGravitButtonDims_();

    this.prevGravityScale_ = 1;
    this.prevGravityDirection_ = vec2.createFrom(0, 1);
    this.currentGravity = vec2.create();

    // Pre-bind the mouse move callback to ease adding and removing event listeners.
    this.gravityButtonMouseMove_ = this.gravityButtonMouseMove_.bind(this);
    this.gravityEl_.addEventListener('mousedown', this.gravityButtonMouseDown_.bind(this));
    document.body.addEventListener('mouseup', this.gravityButtonMouseUp_.bind(this));
};

Controls.prototype = {
    /**
     * Whether or not the blob is rendering in debug mode.
     *
     * @type {Boolean}
     * @private
     */
    debugModeEnabled: null,

    /**
     * The current gravity the blob should be feeling.
     *
     * @type {vec2}
     */
    currentGravity: null,

    /**
     * A reference to the experiment that these controls belong to.
     *
     * @type {Experiment}
     * @private
     */
    experiment_: null,

    /**
     * The dom element for the debug toggle button.
     *
     * @type {Element}
     * @private
     */
    debugEl_: null,

    /**
     * The dom element for the reset button.
     *
     * @type {Element}
     * @private
     */
    resetEl_: null,

    /**
     * The dom element for the gravity control button.
     *
     * @type {Element}
     * @private
     */
    gravityEl_: null,

    /**
     * The dom element for the arrow button inside of the gravity control.
     *
     * @type {Element}
     * @private
     */
    gravityArrow_: null,

    /**
     * A timer id that is set when the user clicks the reset button.
     *
     * @type {number|null}
     */
    resetAnimationTimeout_: null,

    /**
     * The radius of the gravity button.
     *
     * @type {number}
     * @private
     */
    gravityButtonRadius_: null,

    /**
     * The center coordinates of the gravity button.
     *
     * @type {Vec2}
     * @private
     */
    buttonCenter_: null,

    /**
     * The position where the user started their mouse down action. This will be reset to null on
     * the next mouse up event.
     *
     * @type {Vec2|null}
     * @private
     */
    mouseStartPosition_: null,

    /**
     * Called when the reset button is clicked.
     *
     * @param {MouseEvent} evt
     * @private
     */
    resetButtonClicked_: function(evt){
        evt.preventDefault();

        if (this.resetAnimationTimeout_) return;

        evt.target.classList.add('animate');

        this.resetAnimationTimeout_ = setTimeout(function(){
            evt.target.classList.remove('animate');

            this.resetAnimationTimeout_ = null;
        }.bind(this), 500);

        this.experiment_.reset();
    },

    /**
     * Toggle whether or not the blob should be rendering in debug mode.
     *
     * @private
     */
    toggleRenderMode_: function(){
        this.debugModeEnabled = !this.debugModeEnabled;

        if (this.debugModeEnabled){
            document.body.classList.add('debug-mode');
        } else {
            document.body.classList.remove('debug-mode');
        }
    },

    /**
     * Updates the cached dimensions and location of the gravity control button.
     *
     * @private
     */
    updateGravitButtonDims_: function(){
        this.gravityButtonRadius_ = this.gravityEl_.clientWidth / 2;
        this.buttonCenter_ = vec2.createFrom(this.gravityEl_.offsetLeft + this.gravityButtonRadius_,
            this.gravityEl_.offsetTop + this.gravityButtonRadius_);
    },

    /**
     * Called when the user presses their mouse down on the gravity control.
     *
     * @param {MouseEvent} evt
     * @private
     */
    gravityButtonMouseDown_: function(evt){
        evt.preventDefault();

        this.updateGravitButtonDims_();

        // Store the start position so we know if the user has clicked later.
        this.mouseStartPosition_ = Utilities.eventToVec2(evt);

        document.body.addEventListener('mousemove', this.gravityButtonMouseMove_);
    },

    /**
     * Called when ever the user has already pressed down on the gravity button and is now moving
     * their mouse, this method will update the direction and strength of the gravity
     *
     * @param {MouseEvent} evt
     * @private
     */
    gravityButtonMouseMove_: function(evt){
        evt.preventDefault();

        var direction = vec2.subtract(this.buttonCenter_, Utilities.eventToVec2(evt));
        vec2.scale(direction, -1);

        var length = vec2.length(direction);
        var magnitude = (length < this.gravityButtonRadius_) ?
            length / this.gravityButtonRadius_ : 1;

        this.updateGravity_(direction, Math.max(magnitude, 0.3));
    },

    /**
     * Called when ever the user releases their mouse down. This method will check if the user
     * clicked or if they performed a drag.
     *
     * @param {MouseEvent} evt
     * @private
     */
    gravityButtonMouseUp_: function(evt){
        if (!this.mouseStartPosition_) return;

        evt.preventDefault();

        // If the user dragged less that 5px, just assume this was a click.
        if (vec2.dist(Utilities.eventToVec2(evt), this.mouseStartPosition_) < 5){
            if (vec2.length(this.currentGravity)){
                // If the world currently has gravity, disable it.
                this.updateGravity_(vec2.createFrom(0, 0), 0);
            } else {
                // If the world previously did not have gravity, restore the previous values.
                this.updateGravity_(this.prevGravityDirection_, this.prevGravityScale_);
            }
        }

        this.mouseStartPosition_ = null;

        document.body.removeEventListener('mousemove', this.gravityButtonMouseMove_);
    },

    /**
     * Updates the current gravity given a direction and a magnitude.
     * @param {vec2} direction The direction gravity should be pointing.
     * @param {number} magnitude The magnitude of the gravity [0-1];
     */
    updateGravity_: function(direction, magnitude){
        if (magnitude !== 0){
            // Save this state and update the button.
            this.prevGravityScale_ = magnitude;
            this.prevGravityDirection_ = direction;

            // Update the angle of the arrow.
            var angle = Math.atan2(direction[1], direction[0]);
            this.gravityArrow_.style.webkitTransform = 'rotate(' + angle.toFixed(2) + 'rad) ' +
                'scale(' + magnitude + ')';

            document.body.classList.add('gravity-enabled');
        } else {
            document.body.classList.remove('gravity-enabled');
        }

        this.currentGravity = vec2.scale(vec2.normalize(direction),
            Blob.MAX_GRAVITY * magnitude);
    }
};