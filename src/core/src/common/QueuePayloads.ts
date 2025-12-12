import { NexxusAppModelType } from '../models/AppModel';

export interface NexxusBaseQueuePayload {
  event: string;
  [key: string]: any;
}

// Built-in worker payloads
export type NexxusWriterPayload =
  | { event: 'app_created'; data: any; }
  | { event: 'app_updated'; changes: any; }
  | { event: 'model_created'; data: NexxusAppModelType; }
  | { event: 'model_updated'; id: string; changes: any; };

export type NexxusTransportManagerPayload =
  | { event: 'notification_send'; data: NexxusAppModelType; };

// Payload for websocket workers (dynamic instances)
export type NexxusWebsocketPayload =
  | { event: 'device_message'; deviceId: string; data: any; };

export type NexxusMqttPayload =
  | { event: 'mqtt_publish'; topic: string; payload: Buffer; }
  | { event: 'mqtt_subscribe'; topic: string; };

// Map of built-in queue names to their payloads
export interface NexxusBuiltInQueuePayloadMap {
  'writer': NexxusWriterPayload;
  'transport-manager': NexxusTransportManagerPayload;
}

// Map of dynamic queue patterns to their payloads
export interface NexxusDynamicQueuePayloadMap {
  'websockets-transport': NexxusWebsocketPayload;
  'mqtt-transport': NexxusMqttPayload;
}

// Built-in queue names (static)
export type NexxusBuiltInQueueName = keyof NexxusBuiltInQueuePayloadMap;

// Dynamic queue patterns
export type NexxusDynamicQueueType = keyof NexxusDynamicQueuePayloadMap;

export type NexxusDynamicQueuePattern = keyof NexxusDynamicQueuePayloadMap;

// Dynamic queue names: pattern_number (e.g., "websockets_1", "mqtt_2")
export type NexxusDynamicQueueName<T extends NexxusDynamicQueuePattern = NexxusDynamicQueuePattern> = `${T}_${number}`;

// All known queue types
export type NexxusKnownQueueName =
  | NexxusBuiltInQueueName
  | NexxusDynamicQueueName;

// Queue name can be known or any string (for plugins)
export type NexxusQueueName = NexxusKnownQueueName | (string & {});

// Helper to extract pattern from queue name
type ExtractQueuePattern<Q extends string> =
  Q extends `${infer Pattern}_${number}`
    ? Pattern extends NexxusDynamicQueuePattern
      ? Pattern
      : never
    : never;

// Helper to extract queue type from dynamic queue name
export type ExtractQueueType<Q extends string> =
  Q extends `${infer Type}_${number}`
  ? Type extends NexxusDynamicQueueType
    ? Type
    : never
  : never;

// Get payload type for a queue name
export type NexxusQueuePayload<Q extends NexxusQueueName> =
  Q extends NexxusBuiltInQueueName
    ? NexxusBuiltInQueuePayloadMap[Q]
    : Q extends NexxusDynamicQueueName
      ? ExtractQueuePattern<Q> extends NexxusDynamicQueuePattern
        ? NexxusDynamicQueuePayloadMap[ExtractQueuePattern<Q>]
        : NexxusBaseQueuePayload
      : NexxusBaseQueuePayload;
