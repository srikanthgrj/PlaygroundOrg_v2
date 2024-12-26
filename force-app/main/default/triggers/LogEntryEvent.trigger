trigger LogEntryEvent on LogEntryEvent__e(after insert) {
  LoggerSObjectHandler.getHandler(Schema.LogEntryEvent__e.SObjectType, new LogEntryEventHandler()).execute();
}