import { queueManager } from "../lib/queue";
import { eSignCompletePDFWorker } from "./esign-complete-pdf";
import { eSignConfirmationEmailWorker } from "./esign-confirmation-email";
import { eSignNotificationEmailWorker } from "./esign-email";
import { eSignPdfWorker } from "./esign-pdf";
import { sendMemberInviteEmailWorker } from "./member-inivite-email";
import { shareDataRoomEmailWorker } from "./share-data-room-email";
import { shareUpdateEmailWorker } from "./share-update-email";

export async function registerJobs() {
  queueManager.register(shareDataRoomEmailWorker);
  queueManager.register(shareUpdateEmailWorker);
  queueManager.register(sendMemberInviteEmailWorker);
  queueManager.register(eSignNotificationEmailWorker);
  queueManager.register(eSignConfirmationEmailWorker);
  queueManager.register(eSignPdfWorker);
  queueManager.register(eSignCompletePDFWorker);

  //start
  await queueManager.start();
}
