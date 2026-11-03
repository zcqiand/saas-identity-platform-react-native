/**
 * 会话/租户上下文页（REQ-2026-036 S-T1 页面承接）。
 *
 * M01.F01.I01 身份卡 + M01.F03.I01 租户列表 + M01.F03.I02 切租户入口的
 * 组件面：纯展示 + 回调上抛，数据全部来自 context-view 派生（jest 断言位），
 * 刷新/切租户动作由宿主（App）接 auth-service——本组件不持会话状态。
 * renderer 断言随 native 工程面另片（REQ §1 分叉面 1）。
 */
import React from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';

import {buildIdentityCard, buildTenantItems} from './context-view';
import type {SessionSnapshot} from '../../session/session';

export interface ContextScreenProps {
  snapshot: SessionSnapshot;
  onRefresh: () => void;
  onSwitchTenant: (tenantId: string) => void;
}

export function IdentityContextScreen({
  snapshot,
  onRefresh,
  onSwitchTenant,
}: ContextScreenProps): React.JSX.Element {
  const card = buildIdentityCard(snapshot);
  const items = buildTenantItems(snapshot);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.displayName}>{card.displayName}</Text>
        <Text style={styles.tenantLabel}>当前租户：{card.tenantLabel}</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={item => item.tenantId}
        renderItem={({item}) => (
          <Pressable style={styles.row} onPress={() => onSwitchTenant(item.tenantId)}>
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Text style={styles.rowMeta}>
              {item.roleIds.join(',')} {item.selected ? '· 当前' : ''}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>暂无租户成员关系</Text>}
      />
      <Pressable style={styles.refresh} onPress={onRefresh}>
        <Text style={styles.refreshLabel}>刷新</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  displayName: {
    fontSize: 18,
    fontWeight: '600',
  },
  tenantLabel: {
    marginTop: 4,
    fontSize: 13,
    color: '#666666',
  },
  row: {
    paddingVertical: 12,
  },
  rowLabel: {
    fontSize: 15,
  },
  rowMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#999999',
  },
  empty: {
    paddingVertical: 12,
    fontSize: 13,
    color: '#999999',
  },
  refresh: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  refreshLabel: {
    fontSize: 14,
    color: '#1a6dff',
  },
});
