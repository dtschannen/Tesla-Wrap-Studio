/**
 * Godot Bridge - JavaScript glue layer for React <-> Godot communication
 * 
 * This file provides the communication layer between React and the Godot WebAssembly export.
 * It should be loaded before the Godot engine initializes.
 * 
 * Usage:
 * 1. Include this script in your HTML before the Godot game
 * 2. React can call window.godot.sendMessage({ type: "...", ... })
 * 3. Godot calls window.godot.getPendingMessage() to receive messages
 * 4. Godot sends events via window.godot.onGodotMessage() or postMessage
 */

(function() {
  'use strict';

  // Message queue for React -> Godot communication
  const messageQueue = [];

  // Event listeners for Godot -> React communication
  const eventListeners = {};

  // State tracking
  let godotReady = false;
  let carLoaded = false;
  let currentModelId = null;

  /**
   * Initialize the Godot bridge
   */
  function init() {
    console.log('[GodotBridge] Initializing...');

    // Create the global godot object
    window.godot = {
      // =====================================================================
      // React -> Godot: Send messages
      // =====================================================================

      /**
       * Send a message to Godot
       * @param {Object} message - Message object with 'type' and other properties
       */
      sendMessage: function(message) {
        if (!message || typeof message !== 'object') {
          console.error('[GodotBridge] Invalid message:', message);
          return false;
        }

        if (!message.type) {
          console.error('[GodotBridge] Message missing type:', message);
          return false;
        }

        console.log('[GodotBridge] Queueing message:', message.type);
        messageQueue.push(JSON.stringify(message));
        return true;
      },

      /**
       * Send a load_scene message to Godot
       * @param {string} modelId - The model ID to load
       */
      loadScene: function(modelId) {
        return this.sendMessage({
          type: 'load_scene',
          modelId: modelId
        });
      },

      /**
       * Send a texture to Godot (from canvas data URL)
       * @param {string} dataUrl - Base64 data URL of the texture
       */
      setTexture: function(dataUrl) {
        return this.sendMessage({
          type: 'set_texture',
          texture: dataUrl
        });
      },

      /**
       * Send car state to Godot
       * @param {Object} state - Car state object
       */
      setCarState: function(state) {
        return this.sendMessage({
          type: 'set_car_state',
          state: state
        });
      },

      /**
       * Set paint color
       * @param {string} colorName - Paint color name (e.g., "PearlWhite", "SolidBlack")
       */
      setPaint: function(colorName) {
        return this.sendMessage({
          type: 'set_paint',
          color: colorName
        });
      },

      /**
       * Set skin/wrap
       * @param {string} skinName - Skin name or empty string to clear
       */
      setSkin: function(skinName) {
        return this.sendMessage({
          type: 'set_skin',
          skin: skinName
        });
      },

      /**
       * Set camera angle
       * @param {number} horizontal - Horizontal rotation in degrees
       * @param {number} vertical - Vertical rotation in degrees
       * @param {number} distance - Distance from target (optional)
       */
      setCameraAngle: function(horizontal, vertical, distance) {
        return this.sendMessage({
          type: 'set_camera_angle',
          horizontal: horizontal,
          vertical: vertical,
          distance: distance || -1
        });
      },

      /**
       * Set camera to a preset view
       * @param {string} preset - 'front', 'rear', 'left', 'right', 'top', 'three_quarter'
       */
      setCameraPreset: function(preset) {
        return this.sendMessage({
          type: 'set_camera_preset',
          preset: preset
        });
      },

      /**
       * Enable/disable auto-rotation
       * @param {boolean} enabled
       */
      setAutoRotate: function(enabled) {
        return this.sendMessage({
          type: 'set_camera_auto_rotate',
          enabled: enabled
        });
      },

      /**
       * Reset camera to default view
       */
      resetCamera: function() {
        return this.sendMessage({
          type: 'reset_camera'
        });
      },

      // =====================================================================
      // Godot -> React: Receive messages
      // =====================================================================

      /**
       * Called by Godot to get the next pending message
       * @returns {string|null} JSON string of the next message, or null if queue empty
       */
      getPendingMessage: function() {
        if (messageQueue.length === 0) {
          return null;
        }
        return messageQueue.shift();
      },

      /**
       * Check how many messages are pending
       * @returns {number} Number of pending messages
       */
      getPendingMessageCount: function() {
        return messageQueue.length;
      },

      /**
       * Called by Godot to send events back to React
       * @param {Object} event - Event object from Godot
       */
      onGodotMessage: function(event) {
        if (!event || !event.type) {
          console.warn('[GodotBridge] Invalid event from Godot:', event);
          return;
        }

        console.log('[GodotBridge] Received from Godot:', event.type, event.data);

        // Update internal state
        switch (event.type) {
          case 'godot_ready':
            godotReady = true;
            break;
          case 'car_loaded':
            carLoaded = true;
            currentModelId = event.data?.modelId;
            break;
          case 'error':
            console.error('[GodotBridge] Godot error:', event.data?.message);
            break;
        }

        // Notify listeners
        const listeners = eventListeners[event.type] || [];
        listeners.forEach(callback => {
          try {
            callback(event.data);
          } catch (err) {
            console.error('[GodotBridge] Listener error:', err);
          }
        });

        // Also dispatch to global event listeners
        const allListeners = eventListeners['*'] || [];
        allListeners.forEach(callback => {
          try {
            callback(event);
          } catch (err) {
            console.error('[GodotBridge] Global listener error:', err);
          }
        });

        // Post to parent window (for iframe communication)
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(event, '*');
        }

        // Forward to parent window if in iframe
        if (window.parent && window.parent !== window) {
          try {
            window.parent.postMessage(event, '*');
          } catch (err) {
            // Ignore cross-origin errors
          }
        }
      },

      // =====================================================================
      // Event subscription
      // =====================================================================

      /**
       * Subscribe to Godot events
       * @param {string} eventType - Event type to listen for (or '*' for all)
       * @param {function} callback - Callback function
       * @returns {function} Unsubscribe function
       */
      on: function(eventType, callback) {
        if (!eventListeners[eventType]) {
          eventListeners[eventType] = [];
        }
        eventListeners[eventType].push(callback);

        // Return unsubscribe function
        return function() {
          const listeners = eventListeners[eventType];
          const index = listeners.indexOf(callback);
          if (index !== -1) {
            listeners.splice(index, 1);
          }
        };
      },

      /**
       * Unsubscribe from Godot events
       * @param {string} eventType - Event type
       * @param {function} callback - Callback to remove
       */
      off: function(eventType, callback) {
        const listeners = eventListeners[eventType];
        if (!listeners) return;

        const index = listeners.indexOf(callback);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      },

      // =====================================================================
      // State queries
      // =====================================================================

      /**
       * Check if Godot is ready
       * @returns {boolean}
       */
      isReady: function() {
        return godotReady;
      },

      /**
       * Check if a car is loaded
       * @returns {boolean}
       */
      isCarLoaded: function() {
        return carLoaded;
      },

      /**
       * Get the current model ID
       * @returns {string|null}
       */
      getCurrentModelId: function() {
        return currentModelId;
      },

      // =====================================================================
      // Utilities
      // =====================================================================

      /**
       * Clear all pending messages
       */
      clearQueue: function() {
        messageQueue.length = 0;
      },

      /**
       * Reset bridge state (for reloading)
       */
      reset: function() {
        messageQueue.length = 0;
        godotReady = false;
        carLoaded = false;
        currentModelId = null;
      }
    };

    // Listen for postMessage events from parent window
    window.addEventListener('message', function(event) {
      // Accept messages from parent (React app)
      if (event.data && event.data.type) {
        console.log('[GodotBridge] Received postMessage:', event.data.type);
        window.godot.sendMessage(event.data);
      }
    });

    // =====================================================================
    // Godot-compatible aliases (Godot expects these at window level)
    // The SceneManager.gd calls JavaScript.eval() with these function names
    // =====================================================================
    
    // For Godot to send messages to React
    window.godot_sendMessage = function(jsonStr) {
      try {
        const event = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
        window.godot.onGodotMessage(event);
        return true;
      } catch (err) {
        console.error('[GodotBridge] godot_sendMessage error:', err);
        return false;
      }
    };

    // For Godot to check how many messages are pending
    window.godot_pendingMessagesCount = function() {
      return messageQueue.length;
    };

    // For Godot to get the next pending message
    window.godot_getPendingMessage = function() {
      if (messageQueue.length === 0) {
        return '';
      }
      return messageQueue.shift();
    };

    console.log('[GodotBridge] Ready. Use window.godot to communicate with Godot.');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

