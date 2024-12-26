trigger LogEntry on LogEntry__c(before insert, before update, before delete, after insert, after update, after delete, after undelete) {
  LoggerSObjectHandler.getHandler(Schema.LogEntry__c.SObjectType, new LogEntryHandler()).execute();
}