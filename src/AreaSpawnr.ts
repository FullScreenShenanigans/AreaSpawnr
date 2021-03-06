import { IArea, ILocation, IMap, IMapsCreatr, IPreThing, IPreThingsContainers, IPreThingSettings } from "mapscreatr";
import { IMapScreenr } from "mapscreenr";

import { IAreaSpawnr, IAreaSpawnrSettings, ICommandAdder } from "./IAreaSpawnr";

/**
 * Directional equivalents for converting from directions to keys.
 */
const directionKeys: { [i: string]: string } = {
    xDec: "right",
    xInc: "left",
    yDec: "bottom",
    yInc: "top",
};

/**
 * Opposite directions for when finding descending order Arrays.
 */
const directionOpposites: { [i: string]: string } = {
    xDec: "xInc",
    xInc: "xDec",
    yDec: "yInc",
    yInc: "yDec",
};

/**
 * Conditionally returns a measurement based on what direction String is
 * given. This is useful for generically finding boundaries when the
 * direction isn't known, such as in findPreThingsSpawnStart and -End.
 *
 * @param direction   The direction by which to order PreThings, as "xInc",
 *                    "xDec", "yInc", or "yDec".
 * @param top   The upper-most bound to apply within.
 * @param right   The right-most bound to apply within.
 * @param bottom    The bottom-most bound to apply within.
 * @param left    The left-most bound to apply within.
 * @returns Either top, right, bottom, or left, depending on direction.
 */
const getDirectionEnd = (directionKey: string, top: number, right: number, bottom: number, left: number): number => {
    switch (directionKey) {
        case "top":
            return top;
        case "right":
            return right;
        case "bottom":
            return bottom;
        case "left":
            return left;
        default:
            throw new Error(`Unknown directionKey: '${directionKey}'.`);
    }
};

/**
 * Finds the index from which PreThings should stop having an action
 * applied to them in applySpawnAction. This is less efficient than the
 * unused version below, but is more reliable for slightly unsorted groups.
 *
 * @param direction   The direction by which to order PreThings, as "xInc",
 *                    "xDec", "yInc", or "yDec".
 * @param group   The group to find a PreThing index within.
 * @param _mid   The middle of the group. This is currently unused.
 * @param top   The upper-most bound to apply within.
 * @param right   The right-most bound to apply within.
 * @param bottom    The bottom-most bound to apply within.
 * @param left    The left-most bound to apply within.
 * @returns The index to start spawning PreThings from.
 */
const findPreThingsSpawnStart = (
    direction: string,
    group: IPreThing[],
    top: number,
    right: number,
    bottom: number,
    left: number): number => {
    const directionKey: string = directionKeys[direction];
    const directionEnd: number = getDirectionEnd(directionKey, top, right, bottom, left);

    for (let i = 0; i < group.length; i += 1) {
        if ((group as any)[i][directionKey] >= directionEnd) {
            return i;
        }
    }

    return group.length;
};

/**
 * Finds the index from which PreThings should stop having an action
 * applied to them in applySpawnAction. This is less efficient than the
 * unused version below, but is more reliable for slightly unsorted groups.
 *
 * @param direction   The direction by which to order PreThings, as "xInc",
 *                    "xDec", "yInc", or "yDec".
 * @param group   The group to find a PreThing index within.
 * @param _mid   The middle of the group. This is currently unused.
 * @param top   The upper-most bound to apply within.
 * @param right   The right-most bound to apply within.
 * @param bottom    The bottom-most bound to apply within.
 * @param left    The left-most bound to apply within.
 * @returns The index to stop spawning PreThings from.
 */
const findPreThingsSpawnEnd = (direction: string, group: IPreThing[], top: number, right: number, bottom: number, left: number): number => {
    const directionKey: string = directionKeys[direction];
    const directionKeyOpposite: string = directionKeys[directionOpposites[direction]];
    const directionEnd: number = getDirectionEnd(directionKeyOpposite, top, right, bottom, left);

    for (let i: number = group.length - 1; i >= 0; i -= 1) {
        if ((group[i] as any)[directionKey] <= directionEnd) {
            return i;
        }
    }

    return -1;
};

/**
 * Loads GameStartr maps to spawn and unspawn areas on demand.
 */
export class AreaSpawnr implements IAreaSpawnr {
    /**
     * Storage container and lazy loader for GameStartr maps.
     */
    private readonly mapsCreator: IMapsCreatr;

    /**
     * MapScreenr container for attributes copied from Areas.
     */
    private readonly mapScreenr: IMapScreenr;

    /**
     * The names of attributes to be copied to the MapScreenr during setLocation.
     */
    private readonly screenAttributes: string[];

    /**
     * Function for when a PreThing is to be spawned.
     */
    private readonly onSpawn?: (prething: IPreThing) => void;

    /**
     * Function for when a PreThing is to be un-spawned.
     */
    private readonly onUnspawn?: (prething: IPreThing) => void;

    /**
     * If stretches exists, a Function to add stretches to an Area.
     */
    private readonly stretchAdd?: ICommandAdder;

    /**
     * If afters exists, a Function to add afters to an Area.
     */
    private readonly afterAdd?: ICommandAdder;

    /**
     * The name of the currently referenced Map, set by setMap.
     */
    private mapName: string;

    /**
     * The currently referenced Map, set by setMap.
     */
    private mapCurrent: IMap;

    /**
     * The currently referenced Area, set by setLocation.
     */
    private areaCurrent: IArea;

    /**
     * The currently referenced Location, set by setLocation.
     */
    private locationEntered: ILocation;

    /**
     * The current Area's listing of PreThings.
     */
    private prethings: IPreThingsContainers;

    /**
     * Initializes a new instance of the AreaSpawnr class.
     *
     * @param settings   Settings to be used for initialization.
     */
    public constructor(settings: IAreaSpawnrSettings) {
        if (!settings) {
            throw new Error("No settings given to AreaSpawnr.");
        }
        if (!settings.mapsCreatr) {
            throw new Error("No mapsCreatr provided to AreaSpawnr.");
        }
        if (!settings.mapScreenr) {
            throw new Error("No mapsCreatr provided to AreaSpawnr.");
        }

        this.mapsCreator = settings.mapsCreatr;

        this.mapScreenr = settings.mapScreenr;

        this.onSpawn = settings.onSpawn;
        this.onUnspawn = settings.onUnspawn;

        this.screenAttributes = settings.screenAttributes || [];
        this.stretchAdd = settings.stretchAdd;
        this.afterAdd = settings.afterAdd;
    }

    /**
     * @returns The attribute names to be copied to MapScreener.
     */
    public getScreenAttributes(): string[] {
        return this.screenAttributes;
    }

    /**
     * @returns The key by which the current Map is indexed.
     */
    public getMapName(): string {
        return this.mapName;
    }

    /**
     * Gets the map listed under the given name. If no name is provided, the
     * mapCurrent is returned instead.
     *
     * @param name   An optional key to find the map under.
     * @returns A Map under the given name, or the current map if none given.
     */
    public getMap(name?: string): IMap {
        return typeof name === "undefined"
            ? this.mapCurrent
            : this.mapsCreator.getMap(name);
    }

    /**
     * Simple getter pipe to the internal MapsCreator.getMaps() function.
     *
     * @returns A listing of maps, keyed by their names.
     */
    public getMaps(): { [i: string]: IMap } {
        return this.mapsCreator.getMaps();
    }

    /**
     * @returns The current Area.
     */
    public getArea(): IArea {
        return this.areaCurrent;
    }

    /**
     * @returns The name of the current Area.
     */
    public getAreaName(): string {
        return this.areaCurrent.name;
    }

    /**
     * @param location   The key of the Location to return.
     * @returns A Location within the current Map.
     */
    public getLocation(location: string): ILocation {
        return this.areaCurrent.map.locations[location];
    }

    /**
     * @returns The most recently entered Location in the current Area.
     */
    public getLocationEntered(): ILocation {
        return this.locationEntered;
    }

    /**
     * Simple getter function for the internal prethings object. This will be
     * undefined before the first call to setMap.
     *
     * @returns A listing of the current area's Prethings.
     */
    public getPreThings(): IPreThingsContainers {
        return this.prethings;
    }

    /**
     * Sets the currently manipulated Map in the handler to be the one under a
     * given name. Note that this will do very little unless a location is
     * provided.
     *
     * @param name   A key to find the map under.
     * @param location   An optional key for a location to immediately start the
     *                   map in (if not provided, ignored).
     * @returns The now-current map.
     */
    public setMap(name: string, location?: string): IMap {
        // Get the newly current map from this.getMap normally
        this.mapCurrent = this.getMap(name);
        if (!this.mapCurrent) {
            throw new Error(`Unknown Map in setMap: '${name}'.`);
        }

        this.mapName = name;

        // Most of the work is done by setLocation (by default, the map's first)
        if (location !== undefined) {
            this.setLocation(location);
        }

        return this.mapCurrent;
    }

    /**
     * Goes to a particular location in the given map. Area attributes are
     * copied to the MapScreener, PreThings are loaded, and stretches and afters
     * are checked.
     *
     * @param name   The key of the Location to start in.
     * @returns The newly set Location.
     */
    public setLocation(name: string): ILocation {
        const location: ILocation = this.mapCurrent.locations[name];
        if (!location) {
            throw new Error(`Unknown location in setLocation: '${name}'.`);
        }

        this.locationEntered = location;
        this.areaCurrent = location.area;
        this.areaCurrent.boundaries = {
            bottom: 0,
            left: 0,
            right: 0,
            top: 0,
        };

        // Copy all the settings from that area into the MapScreenr container
        for (const attribute of this.screenAttributes) {
            this.mapScreenr.variables[attribute] = (this.areaCurrent as any)[attribute];
        }

        // Reset the prethings object, enabling it to be used as a fresh start
        // For the new Area/Location placements
        this.prethings = this.mapsCreator.getPreThings(location.area);

        // Optional: set stretch commands
        if (this.areaCurrent.stretches) {
            this.setStretches(this.areaCurrent.stretches);
        }

        // Optional: set after commands
        if (this.areaCurrent.afters) {
            this.setAfters(this.areaCurrent.afters);
        }

        return location;
    }

    /**
     * Applies the stretchAdd Function to each given "stretch" command and
     * stores the commands in stretches.
     *
     * @param stretchesRaw   Raw descriptions of the stretches.
     */
    public setStretches(stretchesRaw: (string | IPreThingSettings)[]): void {
        if (!this.stretchAdd) {
            throw new Error("Cannot call setStretches without a stretchAdd.");
        }

        for (let i = 0; i < stretchesRaw.length; i += 1) {
            this.stretchAdd(stretchesRaw[i], i, stretchesRaw);
        }
    }

    /**
     * Applies the afterAdd Function to each given "after" command and stores
     * the commands in afters.
     *
     * @param aftersRaw   Raw descriptions of the afters.
     */
    public setAfters(aftersRaw: (string | IPreThingSettings)[]): void {
        if (!this.afterAdd) {
            throw new Error("Cannot call setAfters without an afterAdd.");
        }

        for (let i = 0; i < aftersRaw.length; i += 1) {
            this.afterAdd(aftersRaw[i], i, aftersRaw);
        }
    }

    /**
     * Calls onSpawn on every PreThing touched by the given bounding box,
     * determined in order of the given direction. This is a simple wrapper
     * around applySpawnAction that also gives it true as the status.
     *
     * @param direction   The direction by which to order PreThings, as "xInc",
     *                    "xDec", "yInc", or "yDec".
     * @param top   The upper-most bound to spawn within.
     * @param right   The right-most bound to spawn within.
     * @param bottom    The bottom-most bound to spawn within.
     * @param left    The left-most bound to spawn within.
     */
    public spawnArea(direction: string, top: number, right: number, bottom: number, left: number): void {
        if (this.onSpawn) {
            this.applySpawnAction(this.onSpawn, true, direction, top, right, bottom, left);
        }
    }

    /**
     * Calls onUnspawn on every PreThing touched by the given bounding box,
     * determined in order of the given direction. This is a simple wrapper
     * around applySpawnAction that also gives it false as the status.
     *
     * @param direction   The direction by which to order PreThings, as "xInc",
     *                    "xDec", "yInc", or "yDec".
     * @param top   The upper-most bound to spawn within.
     * @param right   The right-most bound to spawn within.
     * @param bottom    The bottom-most bound to spawn within.
     * @param left    The left-most bound to spawn within.
     */
    public unspawnArea(direction: string, top: number, right: number, bottom: number, left: number): void {
        if (this.onUnspawn) {
            this.applySpawnAction(this.onUnspawn, false, direction, top, right, bottom, left);
        }
    }

    /**
     * Calls onUnspawn on every PreThing touched by the given bounding box,
     * determined in order of the given direction. This is used both to spawn
     * and un-spawn PreThings, such as during QuadsKeepr shifting. The given
     * status is used as a filter: all PreThings that already have the status
     * (generally true or false as spawned or unspawned, respectively) will have
     * the callback called on them.
     *
     * @param callback   The callback to be run whenever a matching matching
     *                   PreThing is found.
     * @param status   The spawn status to match PreThings against. Only PreThings
     *                 with .spawned === status will have the callback applied.
     * @param direction   The direction by which to order PreThings, as "xInc",
     *                    "xDec", "yInc", or "yDec".
     * @param top   The upper-most bound to apply within.
     * @param right   The right-most bound to apply within.
     * @param bottom    The bottom-most bound to apply within.
     * @param left    The left-most bound to apply within.
     */
    private applySpawnAction(
        callback: (prething: IPreThing) => void,
        status: boolean,
        direction: string,
        top: number,
        right: number,
        bottom: number,
        left: number): void {
        // For each group of PreThings currently able to spawn...
        for (const name in this.prethings) {
            if (!this.prethings.hasOwnProperty(name)) {
                continue;
            }

            // Don't bother trying to spawn the group if it has no members
            const group: IPreThing[] = (this.prethings as any)[name][direction];
            if (group.length === 0) {
                continue;
            }

            // Find the start and end points within the PreThings Array
            // Ex. if direction="xInc", go from .left >= left to .left <= right
            const start: number = findPreThingsSpawnStart(direction, group, top, right, bottom, left);
            const end: number = findPreThingsSpawnEnd(direction, group, top, right, bottom, left);

            // Loop through all the directionally valid PreThings, spawning if
            // They're within the bounding box
            for (let i: number = start; i <= end; i += 1) {
                const prething: IPreThing = group[i];

                // For example: if status is true (spawned), don't spawn again
                if (prething.spawned !== status) {
                    prething.spawned = status;
                    callback(prething);
                }
            }
        }
    }
}
