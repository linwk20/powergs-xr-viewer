import 'xrblocks/addons/simulator/SimulatorAddons.js';

import * as THREE from 'three';
import * as xb from 'xrblocks';

const POWERGS_BASE_URL = './assets/';
const SIMULATOR_SCENE_BASE_URL =
  'https://cdn.jsdelivr.net/gh/xrblocks/assets@a500427f2dfc12312df1a75860460244bab3a146/simulator/scenes/';
const OFFICE_SCENE_PATH =
  `${SIMULATOR_SCENE_BASE_URL}XREmulatorsceneV5_office.glb`;

const SCENE_SOURCES = [
  {
    title: 'PowerGS Bicycle',
    src: `${POWERGS_BASE_URL}bicycle_22_25_900_PowerGS-H_render_compressed.mp4`,
  },
  {
    title: 'PowerGS Hotdog',
    src: `${POWERGS_BASE_URL}hotdog_30_70_40_PowerGS-H_render_compressed.mp4`,
  },
  {
    title: 'PowerGS Materials',
    src: `${POWERGS_BASE_URL}materials_30_70_40_PowerGS-H_render_compressed.mp4`,
  },
  {
    title: 'PowerGS Room',
    src: `${POWERGS_BASE_URL}room_18_20_1440_PowerGS-H_render_compressed.mp4`,
  },
];

const FIXED_DISTANCE = 2.0;
const CONTROLS_DISTANCE = 1.85;
const DEFAULT_SCALE = 1.25;
const MIN_SCALE = 0.85;
const SCALE_STEP = 0.15;
const PLAYER_PAN_STEP = 0.16;
const PLAYER_X_LIMIT = 1.6;
const PLAYER_Y_LIMIT = 1.0;

const BASE_VIDEO_WIDTH = 3.4;
const BASE_VIDEO_HEIGHT = 1.92;
const CONTROLS_WIDTH = 2.72;
const CONTROLS_HEIGHT = 1.72;
const VIDEO_Y_OFFSET = 0.18;
const CONTROLS_Y_OFFSET = -0.26;
const XR_STATUS_CLEAR_DELAY_MS = 3200;

class FloatingVideoViewer extends xb.Script {
  constructor() {
    super();
    this.currentSceneIndex = 0;
    this.loadedSceneIndex = -1;
    this.isPlaying = false;
    this.videoScale = DEFAULT_SCALE;
    this.anchorOrigin = new THREE.Vector3();
    this.baseCameraRotation = new THREE.Quaternion();
    this.videoWorldOffset = new THREE.Vector3();
    this.controlsWorldOffset = new THREE.Vector3();
    this.playerPlaneOffset = new THREE.Vector2();
    this.controlsVisible = true;
    this.sceneStarted = new Array(SCENE_SOURCES.length).fill(false);
    this.boundVideoElement = null;
    this.onVideoEnded = () => {
      this.isPlaying = false;
      this.controlsVisible = true;
      this.refreshUi();
    };
  }

  init() {
    this.add(new THREE.HemisphereLight(0xffffff, 0x0e1628, 1.4));
    this.anchorOrigin.copy(xb.camera.position);
    this.baseCameraRotation.copy(xb.camera.quaternion);
    this.buildVideoPanel();
    this.buildControlsPanel();
    this.updateWorldAnchors();
    this.refreshUi();
  }

  buildVideoPanel() {
    this.videoPanel = new xb.SpatialPanel({
      width: this.getVideoWidth(),
      height: this.getVideoHeight(),
      backgroundColor: '#03060bf0',
      draggable: false,
      useBorderlessShader: true,
      useDefaultPosition: false,
    });
    this.add(this.videoPanel);

    const grid = this.videoPanel.addGrid();
    const row = grid.addRow({weight: 1.0});
    row.addCol({weight: 0.015});
    this.videoView = row.addCol({weight: 0.97}).addVideo({
      src: SCENE_SOURCES[0].src,
      muted: true,
      loop: false,
      autoplay: false,
      crossOrigin: 'anonymous',
    });
    row.addCol({weight: 0.015});

    this.videoPanel.updateLayouts();
  }

  buildControlsPanel() {
    this.controlsPanel = new xb.SpatialPanel({
      width: CONTROLS_WIDTH,
      height: CONTROLS_HEIGHT,
      backgroundColor: '#09111dcc',
      draggable: false,
      useBorderlessShader: true,
      useDefaultPosition: false,
    });
    this.add(this.controlsPanel);

    const grid = this.controlsPanel.addGrid();

    grid.addRow({weight: 0.05});

    this.titleView = grid.addRow({weight: 0.12}).addText({
      text: 'PowerGS Controls',
      fontSize: 0.074,
      fontColor: '#f7fbff',
    });

    this.metaView = grid.addRow({weight: 0.1}).addText({
      text: 'Scene 1/4 | Move 0.00, 0.00 | Scale 1.25x',
      fontSize: 0.038,
      fontColor: '#99a7bf',
    });

    this.panLabelView = grid.addRow({weight: 0.08}).addText({
      text: 'Move Canvas',
      fontSize: 0.052,
      fontColor: '#dce8ff',
    });

    const panRow = grid.addRow({weight: 0.18});
    panRow.addCol({weight: 0.04});
    this.leftButton = panRow.addCol({weight: 0.21}).addTextButton({
      text: 'Left',
      fontSizeDp: 78,
      backgroundColor: '#21496f',
      opacity: 0.95,
      fontColor: '#f7fbff',
      height: 1.05,
      width: 1.06,
    });
    panRow.addCol({weight: 0.03});
    this.upButton = panRow.addCol({weight: 0.21}).addTextButton({
      text: 'Up',
      fontSizeDp: 78,
      backgroundColor: '#21496f',
      opacity: 0.95,
      fontColor: '#f7fbff',
      height: 1.05,
      width: 1.06,
    });
    panRow.addCol({weight: 0.03});
    this.downButton = panRow.addCol({weight: 0.21}).addTextButton({
      text: 'Down',
      fontSizeDp: 78,
      backgroundColor: '#21496f',
      opacity: 0.95,
      fontColor: '#f7fbff',
      height: 1.05,
      width: 1.06,
    });
    panRow.addCol({weight: 0.03});
    this.rightButton = panRow.addCol({weight: 0.21}).addTextButton({
      text: 'Right',
      fontSizeDp: 78,
      backgroundColor: '#21496f',
      opacity: 0.95,
      fontColor: '#f7fbff',
      height: 1.05,
      width: 1.06,
    });
    panRow.addCol({weight: 0.04});

    this.scaleLabelView = grid.addRow({weight: 0.08}).addText({
      text: 'Resize Canvas',
      fontSize: 0.052,
      fontColor: '#dce8ff',
    });

    const sizeRow = grid.addRow({weight: 0.16});
    sizeRow.addCol({weight: 0.06});
    this.smallerButton = sizeRow.addCol({weight: 0.41}).addTextButton({
      text: 'Smaller',
      fontSizeDp: 74,
      backgroundColor: '#245232',
      opacity: 0.95,
      fontColor: '#f7fbff',
      height: 1.05,
      width: 1.06,
    });
    sizeRow.addCol({weight: 0.06});
    this.largerButton = sizeRow.addCol({weight: 0.41}).addTextButton({
      text: 'Larger',
      fontSizeDp: 74,
      backgroundColor: '#5a3523',
      opacity: 0.95,
      fontColor: '#f7fbff',
      height: 1.05,
      width: 1.06,
    });
    sizeRow.addCol({weight: 0.06});

    this.sceneLabelView = grid.addRow({weight: 0.08}).addText({
      text: 'Switch Or Replay',
      fontSize: 0.052,
      fontColor: '#dce8ff',
    });

    const sceneRow = grid.addRow({weight: 0.16});
    sceneRow.addCol({weight: 0.04});
    this.prevButton = sceneRow.addCol({weight: 0.28}).addTextButton({
      text: 'Prev',
      fontSizeDp: 80,
      backgroundColor: '#18365f',
      opacity: 0.95,
      fontColor: '#f7fbff',
      height: 1.05,
      width: 1.06,
    });
    sceneRow.addCol({weight: 0.04});
    this.replayButton = sceneRow.addCol({weight: 0.28}).addTextButton({
      text: 'Replay',
      fontSizeDp: 70,
      backgroundColor: '#4b2d70',
      opacity: 0.95,
      fontColor: '#f7fbff',
      height: 1.05,
      width: 1.06,
    });
    sceneRow.addCol({weight: 0.04});
    this.nextButton = sceneRow.addCol({weight: 0.28}).addTextButton({
      text: 'Next',
      fontSizeDp: 80,
      backgroundColor: '#18365f',
      opacity: 0.95,
      fontColor: '#f7fbff',
      height: 1.05,
      width: 1.06,
    });
    sceneRow.addCol({weight: 0.04});

    grid.addRow({weight: 0.07});

    this.leftButton.onTriggered = () => this.adjustPan(-PLAYER_PAN_STEP, 0);
    this.upButton.onTriggered = () => this.adjustPan(0, PLAYER_PAN_STEP);
    this.downButton.onTriggered = () => this.adjustPan(0, -PLAYER_PAN_STEP);
    this.rightButton.onTriggered = () => this.adjustPan(PLAYER_PAN_STEP, 0);
    this.smallerButton.onTriggered = () => this.adjustScale(-SCALE_STEP);
    this.largerButton.onTriggered = () => this.adjustScale(SCALE_STEP);
    this.prevButton.onTriggered = () => this.shiftScene(-1);
    this.replayButton.onTriggered = () => this.replayScene();
    this.nextButton.onTriggered = () => this.shiftScene(1);

    this.controlsPanel.updateLayouts();
    this.controlsPanel.visible = false;
  }

  getVideoWidth() {
    return BASE_VIDEO_WIDTH * this.videoScale;
  }

  getVideoHeight() {
    return BASE_VIDEO_HEIGHT * this.videoScale;
  }

  shiftScene(direction) {
    const total = SCENE_SOURCES.length;
    this.currentSceneIndex =
      (this.currentSceneIndex + direction + total) % total;
    this.isPlaying = false;
    this.controlsVisible = true;
    this.loadedSceneIndex = -1;
    this.refreshUi();
  }

  replayScene() {
    this.startPlayback(false, true);
  }

  adjustScale(delta) {
    this.videoScale = Math.max(MIN_SCALE, this.videoScale + delta);
    this.videoPanel.width = this.getVideoWidth();
    this.videoPanel.height = this.getVideoHeight();
    this.videoPanel.updateLayouts();
    this.updateWorldAnchors();
    this.refreshUi();
  }

  adjustPan(deltaX, deltaY) {
    this.playerPlaneOffset.x = THREE.MathUtils.clamp(
      this.playerPlaneOffset.x + deltaX,
      -PLAYER_X_LIMIT,
      PLAYER_X_LIMIT
    );
    this.playerPlaneOffset.y = THREE.MathUtils.clamp(
      this.playerPlaneOffset.y + deltaY,
      -PLAYER_Y_LIMIT,
      PLAYER_Y_LIMIT
    );
    this.updateWorldAnchors();
    this.refreshUi();
  }

  startPlayback(reloadScene = false, restartCurrent = false) {
    this.isPlaying = true;
    this.controlsVisible = false;
    this.sceneStarted[this.currentSceneIndex] = true;

    if (reloadScene) {
      this.loadedSceneIndex = -1;
    }

    this.refreshUi();

    if (this.videoView.video) {
      if (restartCurrent || this.videoView.video.ended) {
        this.videoView.video.currentTime = 0;
      }
      this.videoView.play();
    }
  }

  updateWorldAnchors() {
    const videoYOffset = VIDEO_Y_OFFSET + this.playerPlaneOffset.y;
    const controlsYOffset = videoYOffset + CONTROLS_Y_OFFSET;

    this.videoWorldOffset
      .set(this.playerPlaneOffset.x, videoYOffset, -FIXED_DISTANCE)
      .applyQuaternion(this.baseCameraRotation);
    this.controlsWorldOffset
      .set(this.playerPlaneOffset.x, controlsYOffset, -CONTROLS_DISTANCE)
      .applyQuaternion(this.baseCameraRotation);

    this.videoPanel.position
      .copy(this.anchorOrigin)
      .add(this.videoWorldOffset);
    this.controlsPanel.position
      .copy(this.anchorOrigin)
      .add(this.controlsWorldOffset);

    this.videoPanel.quaternion.copy(this.baseCameraRotation);
    this.controlsPanel.quaternion.copy(this.baseCameraRotation);
  }

  refreshUi() {
    const current = SCENE_SOURCES[this.currentSceneIndex];

    if (this.loadedSceneIndex !== this.currentSceneIndex) {
      this.videoView.load(current.src);
      this.loadedSceneIndex = this.currentSceneIndex;
    }

    if (this.videoView.video && !this.isPlaying) {
      if (!this.videoView.video.ended) {
        this.videoView.video.pause();
      }
    } else {
      this.videoView.play();
    }

    this.titleView.setText(
      this.sceneStarted[this.currentSceneIndex]
        ? `${current.title} Controls`
        : `${current.title} Ready`
    );
    this.metaView.setText(
      `Scene ${this.currentSceneIndex + 1}/${SCENE_SOURCES.length} | Move ${this.playerPlaneOffset.x.toFixed(2)}, ${this.playerPlaneOffset.y.toFixed(2)} | Scale ${this.videoScale.toFixed(2)}x`
    );
    this.replayButton.setText(
      this.sceneStarted[this.currentSceneIndex] ? 'Replay' : 'Play'
    );
    this.controlsPanel.visible = this.controlsVisible;
  }

  update() {
    xb.camera.position.copy(this.anchorOrigin);
    xb.camera.quaternion.copy(this.baseCameraRotation);

    if (this.videoView.video !== this.boundVideoElement) {
      if (this.boundVideoElement) {
        this.boundVideoElement.removeEventListener('ended', this.onVideoEnded);
      }

      this.boundVideoElement = this.videoView.video;

      if (this.boundVideoElement) {
        this.boundVideoElement.loop = false;
        this.boundVideoElement.addEventListener('ended', this.onVideoEnded);
        if (!this.isPlaying) {
          this.boundVideoElement.pause();
          this.boundVideoElement.currentTime = 0;
        }
      }
    }
  }

  dispose() {
    if (this.boundVideoElement) {
      this.boundVideoElement.removeEventListener('ended', this.onVideoEnded);
    }
    super.dispose();
  }
}

function attachPersistentXrLauncher() {
  const launchButton = document.getElementById('xr-launch-button');
  const statusView = document.getElementById('xr-launch-status');
  const sessionManager = xb.core?.webXRSessionManager;

  if (!launchButton || !statusView || !sessionManager) {
    return;
  }

  let statusTimeoutId = null;

  const setStatus = (text = '', isError = false, sticky = false) => {
    if (statusTimeoutId) {
      window.clearTimeout(statusTimeoutId);
      statusTimeoutId = null;
    }

    statusView.textContent = text;
    statusView.dataset.visible = text ? 'true' : 'false';
    statusView.dataset.error = isError ? 'true' : 'false';

    if (text && !sticky) {
      statusTimeoutId = window.setTimeout(() => {
        statusView.textContent = '';
        statusView.dataset.visible = 'false';
        statusView.dataset.error = 'false';
      }, XR_STATUS_CLEAR_DELAY_MS);
    }
  };

  const syncButtonLabel = () => {
    launchButton.textContent = sessionManager.currentSession ? 'EXIT XR' : 'ENTER XR';
  };

  sessionManager.addEventListener('ready', () => {
    syncButtonLabel();
    setStatus('');
  });
  sessionManager.addEventListener('unsupported', () => {
    syncButtonLabel();
  });
  sessionManager.addEventListener('sessionstart', () => {
    syncButtonLabel();
    setStatus('');
  });
  sessionManager.addEventListener('sessionend', () => {
    syncButtonLabel();
  });

  launchButton.addEventListener('click', () => {
    try {
      if (sessionManager.currentSession) {
        sessionManager.endSession();
        return;
      }

      if (!sessionManager.isXRSupported()) {
        throw new Error('Immersive XR is not supported in this browser.');
      }

      sessionManager.startSession();
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'Failed to start immersive XR.', true, true);
    }
  });

  syncButtonLabel();
}

document.addEventListener('DOMContentLoaded', async () => {
  const options = new xb.Options();
  options.enableUI();
  options.setAppTitle('XR Blocks PowerGS Viewer');
  options.xrButton.enabled = false;
  const isQuestBrowser = /OculusBrowser|Quest/i.test(navigator.userAgent);
  if (isQuestBrowser) {
    options.enableVR();
  } else {
    options.simulator.scenePath = OFFICE_SCENE_PATH;
    options.simulator.scenePlanesPath = null;
  }
  options.simulator.instructions.enabled = false;
  options.simulator.handPosePanel.enabled = false;
  options.simulator.modeIndicator.enabled = false;
  options.reticles.enabled = true;

  const viewer = new FloatingVideoViewer();
  window.__xb = xb;
  window.__xrImageViewer = viewer;
  window.__xrImageViewerState = () => ({
    currentSceneIndex: viewer.currentSceneIndex,
    currentTitle: SCENE_SOURCES[viewer.currentSceneIndex].title,
    fixedDistance: FIXED_DISTANCE,
    controlsDistance: CONTROLS_DISTANCE,
    videoScale: viewer.videoScale,
    isPlaying: viewer.isPlaying,
    playerOffsetX: viewer.playerPlaneOffset.x,
    playerOffsetY: viewer.playerPlaneOffset.y,
    controlsVisible: viewer.controlsVisible,
    sceneCount: SCENE_SOURCES.length,
  });

  xb.add(viewer);
  await xb.init(options);
  attachPersistentXrLauncher();
});
