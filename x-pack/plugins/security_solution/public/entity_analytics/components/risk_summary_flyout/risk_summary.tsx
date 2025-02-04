/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useMemo } from 'react';
import type { EuiBasicTableColumn } from '@elastic/eui';
import {
  useEuiTheme,
  EuiAccordion,
  EuiTitle,
  EuiSpacer,
  EuiBasicTable,
  EuiFlexGroup,
  EuiFlexItem,
  useEuiFontSize,
} from '@elastic/eui';
import { css } from '@emotion/react';
import { FormattedMessage } from '@kbn/i18n-react';
import { euiThemeVars } from '@kbn/ui-theme';
import { i18n } from '@kbn/i18n';
import { useKibana } from '../../../common/lib/kibana/kibana_react';
import { EntityDetailsLeftPanelTab } from '../../../flyout/entity_details/shared/components/left_panel/left_panel_header';
import type {
  HostRiskScore,
  UserRiskScore,
} from '../../../../common/search_strategy/security_solution/risk_score';
import { InspectButton, InspectButtonContainer } from '../../../common/components/inspect';
import { ONE_WEEK_IN_HOURS } from '../../../timelines/components/side_panel/new_user_detail/constants';
import { FormattedRelativePreferenceDate } from '../../../common/components/formatted_date';
import { RiskScoreEntity } from '../../../../common/entity_analytics/risk_engine';
import { VisualizationEmbeddable } from '../../../common/components/visualization_actions/visualization_embeddable';
import { ExpandablePanel } from '../../../flyout/shared/components/expandable_panel';
import type { RiskScoreState } from '../../api/hooks/use_risk_score';
import { getRiskScoreSummaryAttributes } from '../../lens_attributes/risk_score_summary';
import { useRiskContributingAlerts } from '../../hooks/use_risk_contributing_alerts';

export interface RiskSummaryProps<T extends RiskScoreEntity> {
  riskScoreData: RiskScoreState<T>;
  queryId: string;
  openDetailsPanel: (tab: EntityDetailsLeftPanelTab) => void;
}

interface TableItem {
  category: string;
  count: number;
}
const LENS_VISUALIZATION_HEIGHT = 126; //  Static height in pixels specified by design
const LAST_30_DAYS = { from: 'now-30d', to: 'now' };
const ALERTS_FIELDS: string[] = [];

function isUserRiskData(
  riskData: UserRiskScore | HostRiskScore | undefined
): riskData is UserRiskScore {
  return !!riskData && (riskData as UserRiskScore).user !== undefined;
}

const getEntityData = (riskData: UserRiskScore | HostRiskScore | undefined) => {
  if (!riskData) {
    return;
  }

  if (isUserRiskData(riskData)) {
    return riskData.user;
  }

  return riskData.host;
};

const RiskSummaryComponent = <T extends RiskScoreEntity>({
  riskScoreData,
  queryId,
  openDetailsPanel,
}: RiskSummaryProps<T>) => {
  const { telemetry } = useKibana().services;
  const { data } = riskScoreData;
  const riskData = data && data.length > 0 ? data[0] : undefined;
  const entityData = getEntityData(riskData);
  const { euiTheme } = useEuiTheme();
  const { data: alertsData } = useRiskContributingAlerts({
    riskScore: riskData,
    fields: ALERTS_FIELDS,
  });
  const lensAttributes = useMemo(() => {
    const entityName = entityData?.name ?? '';
    const fieldName = isUserRiskData(riskData) ? 'user.name' : 'host.name';

    return getRiskScoreSummaryAttributes({
      severity: entityData?.risk?.calculated_level,
      query: `${fieldName}: ${entityName}`,
      spaceId: 'default',
      riskEntity: isUserRiskData(riskData) ? RiskScoreEntity.user : RiskScoreEntity.host,
    });
  }, [entityData?.name, entityData?.risk?.calculated_level, riskData]);

  const columns: Array<EuiBasicTableColumn<TableItem>> = useMemo(
    () => [
      {
        field: 'category',
        name: (
          <FormattedMessage
            id="xpack.securitySolution.flyout.entityDetails.categoryColumnLabel"
            defaultMessage="Category"
          />
        ),
        truncateText: false,
        mobileOptions: { show: true },
        sortable: true,
      },
      {
        field: 'count',
        name: (
          <FormattedMessage
            id="xpack.securitySolution.flyout.entityDetails.inputsColumnLabel"
            defaultMessage="Inputs"
          />
        ),
        truncateText: false,
        mobileOptions: { show: true },
        sortable: true,
        dataType: 'number',
      },
    ],
    []
  );

  const xsFontSize = useEuiFontSize('xxs').fontSize;

  const items: TableItem[] = useMemo(
    () => [
      {
        category: i18n.translate('xpack.securitySolution.flyout.entityDetails.alertsGroupLabel', {
          defaultMessage: 'Alerts',
        }),
        count: alertsData?.length ?? 0,
      },
    ],
    [alertsData?.length]
  );

  const onToggle = useCallback(
    (isOpen) => {
      const entity = isUserRiskData(riskData) ? 'user' : 'host';

      telemetry.reportToggleRiskSummaryClicked({
        entity,
        action: isOpen ? 'show' : 'hide',
      });
    },
    [riskData, telemetry]
  );

  return (
    <EuiAccordion
      onToggle={onToggle}
      initialIsOpen
      id={'risk_summary'}
      buttonProps={{
        css: css`
          color: ${euiTheme.colors.primary};
        `,
      }}
      buttonContent={
        <EuiTitle size="xs">
          <h3>
            <FormattedMessage
              id="xpack.securitySolution.flyout.entityDetails.title"
              defaultMessage="Risk summary"
            />
          </h3>
        </EuiTitle>
      }
      extraAction={
        <span
          data-test-subj="risk-summary-updatedAt"
          css={css`
            font-size: ${xsFontSize};
          `}
        >
          {riskData && (
            <FormattedMessage
              id="xpack.securitySolution.flyout.entityDetails.riskUpdatedTime"
              defaultMessage="Updated {time}"
              values={{
                time: (
                  <FormattedRelativePreferenceDate
                    value={riskData['@timestamp']}
                    dateFormat="MMM D, YYYY"
                    relativeThresholdInHrs={ONE_WEEK_IN_HOURS}
                  />
                ),
              }}
            />
          )}
        </span>
      }
    >
      <EuiSpacer size="m" />

      <ExpandablePanel
        data-test-subj="riskInputs"
        header={{
          title: (
            <FormattedMessage
              id="xpack.securitySolution.flyout.entityDetails.riskInputs"
              defaultMessage="Risk inputs"
            />
          ),
          link: {
            callback: () => openDetailsPanel(EntityDetailsLeftPanelTab.RISK_INPUTS),
            tooltip: (
              <FormattedMessage
                id="xpack.securitySolution.flyout.entityDetails.showAllRiskInputs"
                defaultMessage="Show all risk inputs"
              />
            ),
          },
          iconType: 'arrowStart',
        }}
        expand={{
          expandable: false,
        }}
      >
        <EuiFlexGroup gutterSize="m" direction="column">
          <EuiFlexItem grow={false}>
            <div
              // Improve Visualization loading state by predefining the size
              css={css`
                height: ${LENS_VISUALIZATION_HEIGHT}px;
              `}
            >
              {riskData && (
                <VisualizationEmbeddable
                  applyGlobalQueriesAndFilters={false}
                  lensAttributes={lensAttributes}
                  id={`RiskSummary-risk_score_metric`}
                  timerange={LAST_30_DAYS}
                  width={'100%'}
                  height={LENS_VISUALIZATION_HEIGHT}
                  disableOnClickFilter
                  inspectTitle={
                    <FormattedMessage
                      id="xpack.securitySolution.flyout.entityDetails.inspectVisualizationTitle"
                      defaultMessage="Risk Summary Visualization"
                    />
                  }
                />
              )}
            </div>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <InspectButtonContainer>
              <div
                // Anchors the position absolute inspect button (nearest positioned ancestor)
                css={css`
                  position: relative;
                `}
              >
                <div
                  // Position the inspect button above the table
                  css={css`
                    position: absolute;
                    right: 0;
                    top: -${euiThemeVars.euiSize};
                  `}
                >
                  <InspectButton
                    queryId={queryId}
                    title={
                      <FormattedMessage
                        id="xpack.securitySolution.flyout.entityDetails.inspectTableTitle"
                        defaultMessage="Risk Summary Table"
                      />
                    }
                  />
                </div>
                <EuiBasicTable
                  data-test-subj="risk-summary-table"
                  responsive={false}
                  columns={columns}
                  items={items}
                  compressed
                />
              </div>
            </InspectButtonContainer>
          </EuiFlexItem>
        </EuiFlexGroup>
      </ExpandablePanel>
      <EuiSpacer size="s" />
    </EuiAccordion>
  );
};

export const RiskSummary = React.memo(RiskSummaryComponent);
RiskSummary.displayName = 'RiskSummary';
