/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { ALERT_WORKFLOW_STATUS } from '@kbn/rule-data-utils';
import { flattenWithPrefix } from '@kbn/securitysolution-rules';

import { SavedQueryRuleCreateProps } from '@kbn/security-solution-plugin/common/api/detection_engine';
import {
  ALERT_ANCESTORS,
  ALERT_DEPTH,
  ALERT_ORIGINAL_TIME,
  ALERT_ORIGINAL_EVENT,
} from '@kbn/security-solution-plugin/common/field_maps/field_names';
import {
  createRule,
  deleteAllRules,
  deleteAllAlerts,
  getOpenAlerts,
  getRuleForAlertTesting,
} from '../../../utils';
import { FtrProviderContext } from '../../../../../ftr_provider_context';
import { EsArchivePathBuilder } from '../../../../../es_archive_path_builder';

/**
 * Specific _id to use for some of the tests. If the archiver changes and you see errors
 * here, update this to a new value of a chosen auditbeat record and update the tests values.
 */
const ID = 'BhbXBmkBR346wHgn4PeZ';

export default ({ getService }: FtrProviderContext) => {
  const supertest = getService('supertest');
  const esArchiver = getService('esArchiver');
  const es = getService('es');
  const log = getService('log');
  // TODO: add a new service for loading archiver files similar to "getService('es')"
  const config = getService('config');
  const isServerless = config.get('serverless');
  const dataPathBuilder = new EsArchivePathBuilder(isServerless);
  const path = dataPathBuilder.getPath('auditbeat/hosts');

  describe('@ess @serverless Saved query type rules', () => {
    before(async () => {
      await esArchiver.load(path);
    });

    after(async () => {
      await esArchiver.unload(path);
      await deleteAllAlerts(supertest, log, es);
      await deleteAllRules(supertest, log);
    });

    // First test creates a real rule - remaining tests use preview API
    it('should query and get back expected alert structure using a saved query rule', async () => {
      const rule: SavedQueryRuleCreateProps = {
        ...getRuleForAlertTesting(['auditbeat-*']),
        type: 'saved_query',
        query: `_id:${ID}`,
        saved_id: 'doesnt-exist',
      };
      const createdRule = await createRule(supertest, log, rule);
      const alerts = await getOpenAlerts(supertest, log, es, createdRule);
      const alert = alerts.hits.hits[0]._source;
      expect(alert).eql({
        ...alert,
        [ALERT_ANCESTORS]: [
          {
            id: 'BhbXBmkBR346wHgn4PeZ',
            type: 'event',
            index: 'auditbeat-8.0.0-2019.02.19-000001',
            depth: 0,
          },
        ],
        [ALERT_WORKFLOW_STATUS]: 'open',
        [ALERT_DEPTH]: 1,
        [ALERT_ORIGINAL_TIME]: '2019-02-19T17:40:03.790Z',
        ...flattenWithPrefix(ALERT_ORIGINAL_EVENT, {
          action: 'socket_closed',
          dataset: 'socket',
          kind: 'event',
          module: 'system',
        }),
      });
    });
  });
};
