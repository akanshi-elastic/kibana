/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

// @ts-ignore
import { parse } from 'wellknown';
import { Feature, FeatureCollection, GeoJsonProperties } from 'geojson';
import type { ESQLSearchReponse } from '@kbn/es-types';
import { getGeometryColumnIndex } from './esql_utils';

export function convertToGeoJson(resp: ESQLSearchReponse): FeatureCollection {
  const geometryIndex = getGeometryColumnIndex(resp.columns);
  const features: Feature[] = [];
  for (let i = 0; i < resp.values.length; i++) {
    const hit = resp.values[i];
    const wkt = hit[geometryIndex];
    if (!wkt) {
      continue;
    }
    try {
      const geometry = parse(wkt);
      const properties: GeoJsonProperties = {};
      for (let j = 0; j < hit.length; j++) {
        // do not store geometry in properties
        if (j === geometryIndex) {
          continue;
        }
        properties[resp.columns[j].name] = hit[j] as unknown;
      }
      features.push({
        type: 'Feature',
        geometry,
        properties,
      });
    } catch (parseError) {
      // TODO surface parse error in some kind of warning
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}
