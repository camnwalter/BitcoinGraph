import {
  CenterConstraint,
  PixelConstraint,
  SiblingConstraint,
  UIContainer,
  UIRoundedRectangle,
  UIText,
  Window
} from "../../Elementa/index";
import { Colors, GL11, Mode, ScaledResolution } from "./constants";
import { PointCollection } from "./pointcollection";
import type { Axes } from "./types";
import { addCommas } from "./utils/format";
import { createBasicDisplay, createList } from "./utils/index";
import { ZoomHandler } from "./zoomhandler";

export class BitcoinGraph {
  public readonly pointCollection: PointCollection;
  private readonly zoomHandler: ZoomHandler;

  private readonly gui: Gui;

  private readonly textBackground: UIRoundedRectangle;
  private readonly textContainer: UIContainer;
  private readonly window: Window;

  private readonly axes: Axes;

  private changedPos: boolean;
  private changedMouse: boolean;

  private clicked: boolean;
  private dragging: boolean;

  private pointList!: number;
  private lineList!: number;

  private currentCoin!: string;
  constructor() {
    this.pointCollection = new PointCollection();
    this.zoomHandler = new ZoomHandler();

    this.gui = new Gui();

    const { window, container, background } = createBasicDisplay(
      this.pointCollection.right + 10,
      "center",
      true
    );
    // @ts-ignore
    this.window = window;
    this.textContainer = container;
    this.textBackground = background;

    this.axes = [
      [this.pointCollection.left, this.pointCollection.top],
      [this.pointCollection.left, this.pointCollection.bottom],
      [this.pointCollection.right, this.pointCollection.bottom]
    ];

    this.changedPos = true;
    this.changedMouse = true;

    this.clicked = false;
    this.dragging = false;

    // force this context on the current class
    this.shadeGraphBackground = this.shadeGraphBackground.bind(this);
    this.drawIntersectLines = this.drawIntersectLines.bind(this);
    this.drawPoints = this.drawPoints.bind(this);
    this.drawAxes = this.drawAxes.bind(this);

    this.gui.registerScrolled((mx, my, dir) => {
      this.zoomHandler.zoomFunc(mx, my, dir);

      this.changedPos = true;
      this.changedMouse = true;
    });

    register("step", () => {
      if (
        !this.gui.isOpen() ||
        this.pointCollection.currentPlotPoints.length === 0
      )
        return;
      this.changedMouse = true;
      this.drawLabels(this.currentCoin);
    }).setFps(20);

    register("guiMouseClick", () => {
      if (!this.gui.isOpen()) return;
      this.clicked = true;
    });

    register("guiMouseRelease", () => {
      if (!this.gui.isOpen()) return;
      this.clicked = false;
      this.dragging = false;
    });

    register("dragged", (dx, dy) => {
      if (!this.gui.isOpen() || (dx === 0 && dy === 0)) return;
      this.zoomHandler.dragFunc(dx, dy);

      this.changedPos = true;
      this.changedMouse = true;
      if (this.clicked) this.dragging = true;
    });

    register("renderOverlay", () => {
      if (!this.gui.isOpen()) return;
      this.window.draw();
    });
  }

  private resetTransforms(): void {
    this.zoomHandler.reset();
    this.changedPos = true;
    this.changedMouse = true;
  }

  private closestPointToMouse() {
    let currentDistance = Number.MAX_VALUE;
    let closestIndex = 0;

    const mouseX = this.zoomHandler.constrainMouseX();
    this.pointCollection.currentPlotPoints.forEach(({ price }, i) => {
      const { x } = this.pointCollection.priceToPoint(i, price);

      if (Math.abs(mouseX - x) < currentDistance) {
        currentDistance = Math.abs(mouseX - x);
        closestIndex = i;
      }
    });

    return {
      loc: this.pointCollection.priceToPoint(
        closestIndex,
        this.pointCollection.currentPlotPoints[closestIndex].price
      ),
      index: closestIndex
    };
  }

  private shadeGraphBackground(): void {
    GL11.glPushMatrix();
    this.zoomHandler.translateAndScale();

    GL11.glColor3d(...Colors.GRAPH_BACKGROUND);
    GL11.glBegin(GL11.GL_QUADS);
    GL11.glVertex2d(this.pointCollection.left, this.pointCollection.top);
    GL11.glVertex2d(this.pointCollection.left, this.pointCollection.bottom);
    GL11.glVertex2d(this.pointCollection.right, this.pointCollection.bottom);
    GL11.glVertex2d(this.pointCollection.right, this.pointCollection.top);
    GL11.glEnd();
    GL11.glPopMatrix();
  }

  private drawLabels(text: string): void {
    if (this.dragging || this.pointCollection.currentPlotPoints.length === 0)
      return;
    const { index } = this.closestPointToMouse();

    const { date, price } = this.pointCollection.currentPlotPoints[index];
    this.textBackground
      .clearChildren()
      .addChildren(
        new UIText(`§l${text}`)
          .setX(new CenterConstraint())
          .setY(new PixelConstraint(5)),
        new UIText(date)
          .setX(new PixelConstraint(5, true))
          .setY(new SiblingConstraint()),
        new UIText(`$${addCommas(price)}`)
          .setX(new PixelConstraint(5, true))
          .setY(new SiblingConstraint())
      );
  }

  private drawIntersectLines(): void {
    if (this.pointCollection.currentScreenPoints.length === 0) return;
    const {
      loc: { x, y }
    } = this.closestPointToMouse();

    GL11.glPushMatrix();
    GL11.glLineWidth(1);
    this.zoomHandler.translateAndScale();

    GL11.glColor3d(...Colors.INTERSECT_LINES);
    GL11.glBegin(GL11.GL_LINES);
    GL11.glVertex2d(this.pointCollection.left, y);
    GL11.glVertex2d(this.pointCollection.right, y);
    GL11.glVertex2d(x, this.pointCollection.top);
    GL11.glVertex2d(x, this.pointCollection.bottom);

    GL11.glEnd();
    GL11.glPopMatrix();
  }

  private drawPoints(): void {
    GL11.glPushMatrix();
    GL11.glLineWidth(1);
    this.zoomHandler.translateAndScale();

    GL11.glColor3d(...Colors.POINTS);
    GL11.glBegin(GL11.GL_LINE_STRIP);
    this.pointCollection.currentScreenPoints.forEach(({ x, y }) => {
      GL11.glVertex2d(x, y);
    });
    GL11.glEnd();
    GL11.glPopMatrix();
  }

  private drawAxes(): void {
    GL11.glPushMatrix();
    GL11.glLineWidth(2);
    this.zoomHandler.translateAndScale();

    GL11.glColor3d(...Colors.AXES);
    GL11.glBegin(GL11.GL_LINE_STRIP);
    this.axes.forEach(([x, y]) => GL11.glVertex2d(x, y));

    GL11.glEnd();
    GL11.glPopMatrix();
  }

  private drawOutOfBoundsBackground(): void {
    Renderer.drawRect(
      Renderer.color(...Colors.GRAPH_OUT_OF_BOUNDS),
      this.pointCollection.left,
      this.pointCollection.top,
      this.pointCollection.width,
      this.pointCollection.height
    );
  }

  private setupScissor(): void {
    const sr = new ScaledResolution(Client.getMinecraft());
    const scaleFactor = sr.func_78325_e(); // getScaleFactor

    GL11.glScissor(
      this.pointCollection.left * scaleFactor,
      this.pointCollection.top * scaleFactor,
      this.pointCollection.width * scaleFactor,
      this.pointCollection.height * scaleFactor
    );
  }

  private beginDraw(): boolean {
    if (
      !this.gui.isOpen() ||
      this.pointCollection.currentPlotPoints.length === 0
    ) {
      return false;
    }

    this.drawOutOfBoundsBackground();
    this.setupScissor();
    return true;
  }

  public draw(text: string): void {
    if (!this.beginDraw()) return;
    this.currentCoin = text;

    const { changedVar: changedPos, list: pointList } = createList(
      this.changedPos,
      this.pointList,
      this.shadeGraphBackground,
      this.drawAxes,
      this.drawPoints
    );
    this.changedPos = changedPos;
    this.pointList = pointList;

    const { changedVar: changedMouse, list: lineList } = createList(
      this.changedMouse,
      this.lineList,
      this.drawIntersectLines
    );
    this.changedMouse = changedMouse;
    this.lineList = lineList;

    GL11.glCallList(this.pointList);
    GL11.glCallList(this.lineList);
  }

  public drawLive(text: string): void {
    if (!this.beginDraw()) return;
    this.currentCoin = text;

    GL11.glDisable(GL11.GL_TEXTURE_2D);
    GL11.glEnable(GL11.GL_SCISSOR_TEST);

    this.pointCollection.updateRanges();
    this.pointCollection.addPointsToScreen();

    this.shadeGraphBackground();
    this.drawPoints();
    this.drawIntersectLines();

    GL11.glDisable(GL11.GL_SCISSOR_TEST);
    GL11.glEnable(GL11.GL_TEXTURE_2D);
  }

  public open(mode: Mode): void {
    this.resetTransforms();
    this.pointCollection.mode = mode;

    if (this.pointCollection.mode === Mode.HISTORICAL) {
      this.pointCollection.updateRanges();
      this.pointCollection.addPointsToScreen();
    }

    this.gui.open();
  }
}
