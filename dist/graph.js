import { Colors, Range } from "./constants";
import { GL11 } from "./types";
import { addCommas, createList, distSquared, findBounds } from "./utils";
const ScaledResolution = Java.type("net.minecraft.client.gui.ScaledResolution");
export class BitcoinGraph {
    constructor(width, height, backgroundColor) {
        this.width = width;
        this.height = height;
        this.backgroundColor = backgroundColor;
        this.screenWidth = Renderer.screen.getWidth();
        this.screenHeight = Renderer.screen.getHeight();
        this.screenCenterX = this.screenWidth / 2;
        this.screenCenterY = this.screenHeight / 2;
        this.gui = new Gui();
        this.left = this.screenCenterX - this.width / 2;
        this.right = this.screenCenterX + this.width / 2;
        this.top = this.screenCenterY - this.height / 2;
        this.bottom = this.screenCenterY + this.height / 2;
        this.display = new Display()
            .setRenderLoc(this.left - 10, this.screenCenterY)
            .setAlign(DisplayHandler.Align.RIGHT)
            .setBackground(DisplayHandler.Background.FULL)
            .setTextColor(Colors.TEXT)
            .setBackgroundColor(Colors.TEXT_BACKGROUND);
        this.totalPlotPoints = [];
        this.currentPlotPoints = [];
        this.currentScreenPoints = [];
        this.zoom = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.xAxis = [this.left, this.bottom, this.right, this.bottom];
        this.yAxis = [this.left, this.top, this.left, this.bottom];
        this.changedPos = true;
        this.changedMouse = true;
        this.clicked = false;
        this.dragging = false;
        this.mousePos = [-1, -1];
        this.totalDays = 0;
        this.maxPrice = 0;
        this.shadeGraphBackground = this.shadeGraphBackground.bind(this);
        this.drawAxes = this.drawAxes.bind(this);
        this.drawIntersectLines = this.drawIntersectLines.bind(this);
        this.drawPoints = this.drawPoints.bind(this);
        this.gui.registerScrolled((mx, my, dir) => {
            this.offsetX -= mx;
            this.offsetY -= my;
            const delta = dir > 0 ? 1.25 : 0.8;
            this.zoom *= delta;
            this.offsetX *= delta;
            this.offsetY *= delta;
            this.offsetX += mx;
            this.offsetY += my;
            this.changedPos = true;
            this.changedMouse = true;
        });
        this.gui.registerKeyTyped((typed, key) => {
            if (key === Keyboard.KEY_R) {
                this.resetTransforms();
            }
        });
        register("step", (steps) => {
            if (!this.gui.isOpen())
                return;
            this.mousePos[0] = this.mousePos[1];
            this.mousePos[1] = Client.getMouseX();
            if (this.mousePos[0] !== this.mousePos[1]) {
                this.changedMouse = true;
                this.drawLabels();
            }
        }).setFps(20);
        register("clicked", (mx, my, btn, down) => {
            this.clicked = down;
            if (!down)
                this.dragging = false;
        });
        register("dragged", (dx, dy, mx, my, btn) => {
            if (!this.gui.isOpen() || (dx === 0 && dy === 0))
                return;
            this.offsetX += dx;
            this.offsetY += dy;
            this.changedPos = true;
            this.changedMouse = true;
            if (this.clicked)
                this.dragging = true;
        });
    }
    resetTransforms() {
        this.offsetX = 0;
        this.offsetY = 0;
        this.zoom = 1;
        this.changedPos = true;
        this.changedMouse = true;
    }
    addPointsToScreen() {
        this.currentScreenPoints = [];
        this.currentPlotPoints.forEach(({ price }, i) => {
            this.currentScreenPoints.push(this.priceToPoint(i, price));
        });
    }
    addPlotPoints(points) {
        this.totalPlotPoints = points;
    }
    setGraphRange(type) {
        if (type.toLowerCase() === "max") {
            this.currentPlotPoints = this.totalPlotPoints;
        }
        else {
            this.currentPlotPoints = this.totalPlotPoints.slice(-Range[type]);
        }
        this.resetTransforms();
    }
    priceToPoint(index, price) {
        const x = this.left + (index / this.totalDays) * this.width;
        const y = this.bottom - (price / this.maxPrice) * this.height;
        return { x, y };
    }
    constrainMouseX() {
        return (Client.getMouseX() - this.offsetX) / this.zoom;
    }
    closestPointToMouse() {
        let currentDistance = Number.MAX_VALUE;
        let closestIndex = -1;
        const mouseX = this.constrainMouseX();
        this.currentPlotPoints.forEach(({ price }, i) => {
            const { x } = this.priceToPoint(i, price);
            if (distSquared(mouseX, 0, x, 0) < currentDistance) {
                currentDistance = distSquared(mouseX, 0, x, 0);
                closestIndex = i;
            }
        });
        return {
            loc: this.priceToPoint(closestIndex, this.currentPlotPoints[closestIndex].price),
            index: closestIndex
        };
    }
    shadeGraphBackground() {
        GL11.glPushMatrix();
        GL11.glTranslated(this.offsetX, this.offsetY, 0);
        GL11.glScaled(this.zoom, this.zoom, this.zoom);
        GL11.glColor3d(...Colors.GRAPH_BACKGROUND);
        GL11.glBegin(GL11.GL_QUADS);
        GL11.glVertex2d(this.left, this.top);
        GL11.glVertex2d(this.left, this.bottom);
        GL11.glVertex2d(this.right, this.bottom);
        GL11.glVertex2d(this.right, this.top);
        GL11.glEnd();
        GL11.glPopMatrix();
    }
    drawIntersectLines() {
        if (!this.currentScreenPoints.length)
            return;
        const { loc: { x, y } } = this.closestPointToMouse();
        GL11.glPushMatrix();
        GL11.glLineWidth(1);
        GL11.glTranslated(this.offsetX, this.offsetY, 0);
        GL11.glScaled(this.zoom, this.zoom, this.zoom);
        GL11.glColor3d(...Colors.INTERSECT_LINES);
        GL11.glBegin(GL11.GL_LINES);
        GL11.glVertex2d(this.left, y);
        GL11.glVertex2d(this.right, y);
        GL11.glVertex2d(x, this.top);
        GL11.glVertex2d(x, this.bottom);
        GL11.glEnd();
        GL11.glPopMatrix();
    }
    drawPoints() {
        GL11.glPushMatrix();
        GL11.glLineWidth(1);
        GL11.glTranslated(this.offsetX, this.offsetY, 0);
        GL11.glScaled(this.zoom, this.zoom, this.zoom);
        GL11.glColor3d(...Colors.POINTS);
        GL11.glBegin(GL11.GL_LINE_STRIP);
        this.currentScreenPoints.forEach((p) => GL11.glVertex2d(p.x, p.y));
        GL11.glEnd();
        GL11.glPopMatrix();
    }
    drawAxes() {
        GL11.glPushMatrix();
        GL11.glTranslated(this.offsetX, this.offsetY, 0);
        GL11.glScaled(this.zoom, this.zoom, this.zoom);
        GL11.glLineWidth(2);
        GL11.glColor3d(...Colors.AXES);
        GL11.glBegin(GL11.GL_LINES);
        GL11.glVertex2d(this.xAxis[0], this.xAxis[1]);
        GL11.glVertex2d(this.xAxis[2], this.xAxis[3]);
        GL11.glVertex2d(this.yAxis[0], this.yAxis[1]);
        GL11.glVertex2d(this.yAxis[2], this.yAxis[3]);
        GL11.glEnd();
        GL11.glPopMatrix();
    }
    draw() {
        if (!this.gui.isOpen()) {
            if (this.display.getLines().length)
                this.display.clearLines();
            return;
        }
        Renderer.drawRect(this.backgroundColor, this.left, this.top, this.width, this.height);
        const sr = new ScaledResolution(Client.getMinecraft());
        const scaleFactor = sr.func_78325_e();
        GL11.glScissor(this.left * scaleFactor, this.top * scaleFactor, this.width * scaleFactor, this.height * scaleFactor);
        const { changedVar: changedPos, list: pointList } = createList(this.changedPos, this.pointList, this.shadeGraphBackground, this.drawAxes, this.drawPoints);
        this.changedPos = changedPos;
        this.pointList = pointList;
        const { changedVar: changedMouse, list: lineList } = createList(this.changedMouse, this.lineList, this.drawIntersectLines);
        this.changedMouse = changedMouse;
        this.lineList = lineList;
        GL11.glCallList(this.pointList);
        GL11.glCallList(this.lineList);
    }
    drawLabels() {
        if (this.dragging)
            return;
        const { index } = this.closestPointToMouse();
        const { date, price } = this.currentPlotPoints[index];
        this.display.setLine(0, date).setLine(1, addCommas(price));
    }
    open() {
        const { xMax, yMax } = findBounds(this.currentPlotPoints);
        this.totalDays = xMax;
        this.maxPrice = yMax;
        this.addPointsToScreen();
        this.changedPos = true;
        this.changedMouse = true;
        this.gui.open();
    }
}