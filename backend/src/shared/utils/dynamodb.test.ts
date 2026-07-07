import { mockClient } from 'aws-sdk-client-mock';
import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { db, queryAll, scanAll, queryCount } from './dynamodb';

const ddbMock = mockClient(db);

beforeEach(() => ddbMock.reset());

describe('queryAll', () => {
  it('concatenates items across multiple pages, passing LastEvaluatedKey back in as ExclusiveStartKey', async () => {
    ddbMock
      .on(QueryCommand)
      .resolvesOnce({ Items: [{ id: '1' }], LastEvaluatedKey: { PK: 'a' } })
      .resolvesOnce({ Items: [{ id: '2' }] });

    const result = await queryAll({ TableName: 'x' } as any);

    expect(result).toEqual([{ id: '1' }, { id: '2' }]);
    expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(2);
    expect(ddbMock.commandCalls(QueryCommand)[1]?.args[0].input.ExclusiveStartKey).toEqual({ PK: 'a' });
  });

  it('returns a single page unchanged when there is no LastEvaluatedKey', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [{ id: '1' }] });
    const result = await queryAll({ TableName: 'x' } as any);
    expect(result).toEqual([{ id: '1' }]);
    expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(1);
  });

  it('returns an empty array when a page has no Items', async () => {
    ddbMock.on(QueryCommand).resolves({});
    expect(await queryAll({ TableName: 'x' } as any)).toEqual([]);
  });
});

describe('scanAll', () => {
  it('concatenates items across multiple pages', async () => {
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({ Items: [{ id: '1' }], LastEvaluatedKey: { PK: 'a' } })
      .resolvesOnce({ Items: [{ id: '2' }] });

    const result = await scanAll({ TableName: 'x' } as any);

    expect(result).toEqual([{ id: '1' }, { id: '2' }]);
    expect(ddbMock.commandCalls(ScanCommand)).toHaveLength(2);
  });
});

describe('queryCount', () => {
  it('sums Count across all pages rather than returning only the first page', async () => {
    ddbMock
      .on(QueryCommand)
      .resolvesOnce({ Count: 5, LastEvaluatedKey: { PK: 'a' } })
      .resolvesOnce({ Count: 3 });

    const result = await queryCount({ TableName: 'x' } as any);

    expect(result).toBe(8);
    expect(ddbMock.commandCalls(QueryCommand)[0]?.args[0].input.Select).toBe('COUNT');
    expect(ddbMock.commandCalls(QueryCommand)[1]?.args[0].input.Select).toBe('COUNT');
  });
});
