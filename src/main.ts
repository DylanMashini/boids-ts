import "./style.css";
import * as THREE from "three";

// const app = document.querySelector<HTMLDivElement>("#app")!;
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
const colorList = [0x8ce68c, 0xabf1bc, 0xaee7f8, 0x87cdf6];
//easier variation of rules that still keeps separation alignment and cohesion
const boidCount = 100;
const boxSize = 50;
const distanceCalc = (
	a: { x: number; y: number; z: number },
	b: { x: number; y: number; z: number }
) => {
	return Math.sqrt(
		Math.pow(a.x - b.x, 2) + Math.pow(a.y - a.y, 2) + Math.pow(a.z - b.z, 2)
	);
};

class boid {
	x: number;
	y: number;
	z: number;
	rot: THREE.Vector3;
	geo: THREE.ConeGeometry;
	mat: THREE.MeshBasicMaterial;
	mesh: THREE.Mesh;
	distanceFromCenter: number;
	vel: THREE.Vector3;
	closeCount: number;
	color: THREE.Color;
	constructor(scene: THREE.Scene) {
		this.x = this.randomPosition("x");
		this.y = this.randomPosition("y");
		this.z = this.randomPosition("z");
		this.rot = new THREE.Vector3(
			(Math.PI / Math.random()) * 2,
			(Math.PI / Math.random()) * 2,
			(Math.PI / Math.random()) * 2
		);
		this.geo = new THREE.ConeGeometry(0.5, 2, 32, 32);
		this.color = new THREE.Color(
			colorList[Math.floor(Math.random() * colorList.length)]
		);
		this.mat = new THREE.MeshBasicMaterial({ color: this.color });
		this.mesh = new THREE.Mesh(this.geo, this.mat);
		this.mesh.position.x = this.x;
		this.mesh.position.y = this.y;
		this.mesh.position.z = this.z;
		this.mesh.rotation.set(this.rot.x, this.rot.y, this.rot.z);
		this.vel = new THREE.Vector3(0, 0, 0);
		this.closeCount = 0;
		scene.add(this.mesh);
		this.distanceFromCenter = distanceCalc(
			{ x: 0, y: 0, z: 0 },
			{ x: this.x, y: this.y, z: this.z }
		);
	}
	updateBoid() {
		this.mesh.position.add(this.vel);
		this.x = this.mesh.position.x;
		this.y = this.mesh.position.y;
		this.z = this.mesh.position.z;
		this.mesh.quaternion.setFromUnitVectors(
			new THREE.Vector3(0, 1, 0),
			this.vel.clone().normalize()
		);
	}
	randomPosition(axis: String) {
		//create multiplier to allow negative values
		const neg = Math.random() > 0.5 ? -1 : 1;
		switch (axis) {
			case "x":
				return Math.random() * neg * (boxSize / 2);
			case "y":
				return Math.random() * neg * (boxSize / 2);
			case "z":
				return Math.random() * neg * (boxSize / 2);
		}
		return 0;
	}
	distanceRule(boids: boid[], count: number) {
		const minDistance = 1;
		for (let i = 0; i < boids.length; i++) {
			if (i != count) {
				const distance = this.mesh.position.distanceTo(
					boids[i].mesh.position
				);
				if (distance < minDistance) {
					//boids are too close together
					let d = new THREE.Vector3();
					d.subVectors(this.mesh.position, boids[i].mesh.position);
					this.vel.add(d.multiplyScalar(Math.random() * 5));
					this.closeCount += 1;
				} else {
					this.closeCount = 0;
				}
				if (this.closeCount > 5) {
					console.log("birds too close");
				}
			}
		}
	}
	calcBoid(boids: boid[]) {
		//set inital values for rules + counts to average out the boids
		const seperationSum = new THREE.Vector3(0, 0, 0);
		const allignmentSum = new THREE.Vector3(0, 0, 0);
		const cohesionSum = new THREE.Vector3(0, 0, 0);

		let seperationCount = 0;
		let allignmentCount = 0;
		let cohesionCount = 0;
		const neighbohoodSize = 10;
		const maxSpeed = 0.5;
		const maxForce = 0.03;
		for (let i = 0; i < boids.length; i++) {
			//get distance of boid at i from current boid
			const distance = this.mesh.position.distanceTo(
				boids[i].mesh.position
			);
			if (distance > 0) {
				//get sum of velocity of all neighbors in a given distance for allignment
				if (distance < neighbohoodSize) {
					allignmentSum.add(boids[i].vel);
					allignmentCount++;
				}
				//sum up all POSITIONS of all neighbors in a given distance for cohesion
				if (distance < neighbohoodSize) {
					cohesionSum.add(boids[i].mesh.position);
					cohesionCount++;
				}
				//do seperation rule
				if (distance < neighbohoodSize) {
					const vecDir = new THREE.Vector3().subVectors(
						this.mesh.position,
						boids[i].mesh.position
					);
					vecDir.normalize();
					vecDir.divideScalar(distance);
					seperationSum.add(vecDir);
					seperationCount++;
				}
			}
		}
		//calculate alignment force
		if (allignmentCount > 0) {
			allignmentSum.divideScalar(allignmentCount);
			allignmentSum.setLength(maxSpeed);
			allignmentSum.sub(this.vel);
			allignmentSum.clampLength(0, maxForce);
		} else {
			allignmentSum.set(0, 0, 0);
		}
		//calculate cohesion force
		if (cohesionCount > 0) {
			cohesionSum.divideScalar(cohesionCount);
			cohesionSum.copy(this.steerTo(cohesionSum, maxSpeed, maxForce));
		}
		//calculate seperation force
		if (seperationCount > 0) {
			seperationSum.divideScalar(seperationCount);
		}
		if (seperationSum.length() > 0) {
			seperationSum.setLength(maxSpeed);
			seperationSum.sub(this.vel);
			seperationSum.clampLength(0, maxForce);
		}
		return [allignmentSum, cohesionSum, seperationSum];
	}
	steerTo(target: any, maxSpeed: any, maxForce: any) {
		const targetVec = new THREE.Vector3().subVectors(
			target,
			this.mesh.position
		);

		targetVec.setLength(maxSpeed);

		const steer = new THREE.Vector3().subVectors(this.vel, targetVec);
		steer.clampLength(0, maxForce);
		return steer;
	}
	move(boids: boid[]) {
		//move rotation to be closer to avg rotation
		// this.geo.translate(0, 0.1, 0);
		//apply distance rule to velocity
		const maxSpeed = 0.5;

		const [allignment, seperation, cohesion] = this.calcBoid(boids);
		const acceleration = new THREE.Vector3(0, 0, 0);
		acceleration.add(seperation);
		acceleration.add(allignment);
		acceleration.add(cohesion);
		if (this.mesh.position.length() > boxSize - 30) {
			const homeForce = this.steerTo(
				new THREE.Vector3(0, 0, 0),
				maxSpeed,
				0.03
			).multiplyScalar(1);
			acceleration.sub(homeForce);
		}
		this.vel.add(acceleration).clampLength(0, maxSpeed);
		this.updateBoid();
	}
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
	75,
	window.innerWidth / window.innerHeight,
	0.1,
	1000
);
const renderer = new THREE.WebGLRenderer({
	canvas: document.querySelector("#canvas") as HTMLCanvasElement,
});
scene.background = new THREE.Color(0xffffff);
const boxgeo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
const boxmat = new THREE.MeshBasicMaterial({ color: 0x000000 });
boxmat.transparent = true;
boxmat.opacity = 0.1;
const box = new THREE.Mesh(boxgeo, boxmat);
scene.add(box);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.setZ(boxSize + 15);
const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

//initialize boids
const boids = new Array<boid>();
for (let i = 0; i < boidCount; i++) {
	const bird = new boid(scene);
	boids.push(bird);
}

const animate = () => {
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
	boids.forEach(boid => {
		boid.move(boids);
	});
};
animate();
