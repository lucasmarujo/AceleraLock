package com.aceleralock.blocker

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Fecha o laco que o backend previu: o payload do push carrega apenas
 * {type, unlockRequestId} — nenhuma decisao, nenhum prazo — porque o app e
 * obrigado a buscar a verdade no sync. Isso so funciona se alguem buscar com o
 * app fechado, e este servico e esse alguem.
 *
 * Nada aqui le o conteudo do push como autoridade. O push so diz "vale a pena
 * sincronizar agora".
 */
class PushMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        BlockerService.start(this)
        BlockerService.requestSync(this)
    }

    override fun onNewToken(token: String) {
        BlockerService.reportPushToken(this, token)
    }
}
