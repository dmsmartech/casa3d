# Casa 3D per Home Assistant

**La tua casa in 3D dentro Home Assistant, da toccare per accendere le luci e comandare i dispositivi.**

## Che cos'è

Home Assistant di solito mostra la casa come un elenco di pulsanti e di schede. Con questo kit, invece, nella tua dashboard compare **un modello tridimensionale della tua casa**, vista dall'alto, con le stanze, i mobili e le lampade dove sono davvero.

Per farti vedere l'interno delle stanze, i muri sono mostrati bassi, all'altezza di un tavolo circa: guardando dall'alto vedi i pavimenti, gli arredi e le lampade di ogni stanza.

Ecco cosa puoi fare:

- **Accendere e spegnere con un tocco.** Tocchi l'icona della lampada del soggiorno sul tablet: la lampada vera si accende, e nella casa 3D la stanza si illumina proprio come quando la lampada è accesa.
- **Entrare in una stanza.** Tocchi la cucina: la vista si avvicina alla cucina e sotto compaiono i comandi di Home Assistant per quella stanza, cioè luci, tapparelle, clima e così via.
- **Vedere lo stato della casa a colpo d'occhio.** Una finestra aperta, il robot aspirapolvere al lavoro, una pianta da annaffiare: ogni cosa ha la sua icona nel punto giusto della casa.
- **Giorno e sera.** Di giorno la casa è chiara e luminosa. Al tramonto la casa passa alla sera, e restano illuminate solo le stanze in cui le luci sono davvero accese. Insieme alla casa si scurisce anche il resto della dashboard.

La casa 3D funziona in modo fluido anche su iPad, nell'app di Home Assistant.

## Chi costruisce la tua casa

**Non devi saper programmare né saper usare programmi di grafica 3D.** Il lavoro lo fa un'intelligenza artificiale (AI) che lavora direttamente sul tuo computer.

Funziona così. Tu dai all'AI il testo di istruzioni contenuto in questo kit, cioè il file [`PROMPT.md`](PROMPT.md). Da quel momento è l'AI a guidarti: ti fa una domanda alla volta, quasi sempre con delle risposte già pronte tra cui scegliere. Intanto costruisce la tua casa, la collega ai tuoi dispositivi e la prova. A ogni passo ti mostra il risultato e va avanti solo quando le dici che va bene.

## Cosa è uguale per tutti e cosa è tuo

Tutte le case fatte con questo kit funzionano e si muovono allo stesso modo: stesso aspetto, stesse animazioni, stesso passaggio dal giorno alla sera, stessa barra con l'elenco delle stanze, stessa fluidità.

Quello che cambia è ciò che appartiene alla tua casa: la pianta delle stanze, i pavimenti, i colori, i mobili, le lampade e i dispositivi collegati.

---

## Di cosa hai bisogno

### 1. Un'AI che possa lavorare sul tuo computer

Non basta una chat che risponde e basta. Serve un'AI che possa **usare il tuo computer**: installare programmi, creare il modello 3D della casa, aprire la pagina per controllare il risultato e leggere il tuo Home Assistant.

- Di solito queste AI richiedono un **abbonamento a pagamento**, perché i piani gratuiti in genere non permettono di lavorare sul computer.
- Il lavoro è lungo, e una casa di 6-8 stanze richiede diverse sessioni. Con l'abbonamento più economico puoi arrivare in fondo, ma è probabile che a volte tu debba aspettare qualche ora prima di poter continuare. Un abbonamento più alto ti fa fermare meno spesso.

### 2. Un computer

- **Un computer Mac, Windows o Linux.**
- Almeno **10 GB di spazio libero**.
- Il computer deve poter restare acceso a lungo. Per ottenere luci realistiche, il programma di grafica calcola come la luce del giorno, della sera e di ogni lampada si posa sui muri, sui pavimenti e sui mobili. È un lavoro pesante: per ogni piano della casa può richiedere da 20 minuti a qualche ora.

### 3. I programmi

Non devi installarli tu: li installa l'AI, dopo averti chiesto il permesso.

| Programma | A cosa serve |
|---|---|
| **Blender** (gratuito) | il programma di grafica 3D con cui l'AI costruisce la casa e calcola le luci |
| **Node.js** e **Python** (gratuiti) | preparano la casa 3D per Home Assistant e la provano in automatico |
| Alcuni piccoli programmi gratuiti | rendono leggeri le immagini e il modello, così la casa si apre in fretta anche sul tablet |

### 4. Home Assistant

- **Home Assistant già funzionante**, con i tuoi dispositivi collegati (luci, tapparelle, clima, TV, sensori). Il kit non aggiunge dispositivi nuovi: mostra e comanda **quelli che hai già**.
- Un **utente amministratore** di Home Assistant, perché bisogna aggiungere la casa 3D a una dashboard.
- **Il collegamento tra l'AI e Home Assistant**, con una chiave di accesso oppure con HA-MCP. È spiegato nel paragrafo qui sotto.
- Un modo per copiare i file della casa 3D dentro Home Assistant, cioè la condivisione delle cartelle di rete (componente aggiuntivo *Samba*) oppure l'accesso da terminale (componente aggiuntivo *SSH*). Se non sai quale scegliere, te lo spiega l'AI.
- **L'app di Home Assistant** sul tablet o sul telefono su cui userai la casa 3D.

#### Come l'AI parla con Home Assistant

L'AI deve poter vedere il tuo Home Assistant, cioè sapere quali dispositivi hai e in quali stanze sono, e deve poterci lavorare. In particolare deve poter:

- **leggere i tuoi dispositivi e le tue stanze**, per proporti quali collegare alla casa 3D. Per esempio: «In cucina ho trovato la luce dell'isola e la striscia LED sotto i pensili: le colleghiamo tutte e due?»;
- **creare l'interruttore Giorno/Sera** della casa 3D, così la scelta vale su tutti i tuoi tablet e telefoni;
- **aggiungere la casa 3D alla tua dashboard**, dopo averne salvato una copia e solo quando le dai il via.

Ci sono due modi per collegarla, e all'inizio l'AI ti chiede quale preferisci. In tutti e due i casi ti guida passo per passo.

**1. Con una chiave di accesso (token).** È il modo più semplice, perché non si installa niente. In Home Assistant crei una chiave di accesso a lunga durata (dal tuo profilo, nella sezione Sicurezza) e la incolli nel file che ti indica l'AI, dentro la cartella del kit. Da quel momento l'AI la usa per lavorare sul tuo Home Assistant. Il file resta solo sul tuo computer e non viene mai pubblicato.

**2. Con HA-MCP.** [HA-MCP](https://github.com/homeassistant-ai/ha-mcp) è un componente gratuito che si aggiunge a Home Assistant e fa da ponte tra l'AI e la tua casa. Si installa dal Marketplace di Home Assistant, e la sua [guida](https://github.com/homeassistant-ai/ha-mcp#-get-started) spiega tutti i passi. È comodo se vuoi usare anche in futuro la tua AI per gestire Home Assistant, per esempio per creare automazioni parlandole.

Home Assistant ha anche un suo collegamento per le AI già incluso, ma serve solo ad accendere e spegnere i dispositivi: non permette di creare l'interruttore Giorno/Sera né di modificare le dashboard, quindi per questo kit non basta.

Alla fine, qualunque modo tu scelga, l'AI controlla che il collegamento funzioni leggendo l'elenco delle tue stanze. Password e chiavi di accesso le crei e le inserisci sempre tu.

### 5. Le informazioni sulla tua casa

L'AI non inventa nulla: costruisce solo quello che vede nel materiale che le dai.

- La **piantina** di ogni piano, con le misure. Va bene anche la foto della piantina del progetto o dell'atto di acquisto.
- Le **foto di ogni stanza**, scattate dai quattro angoli, più quelle dei mobili e delle lampade.
- Facoltativa ma molto utile: una **scansione 3D** della casa fatta con un iPhone o un iPad Pro, con app come *3D Scanner App* o *Polycam*.
- Se la casa non esiste ancora ed è solo un progetto, basta una piantina che approvi tu.

### 6. Il tempo

Conta qualche giorno, distribuito in più sessioni. L'AI ti guida in queste fasi:

1. le domande sulla casa e l'elenco di stanze, mobili e dispositivi;
2. la costruzione della casa stanza per stanza, con un'immagine da approvare per ogni stanza;
3. il calcolo delle luci, prima in versione veloce per controllare e poi in quella definitiva;
4. il collegamento dei tuoi dispositivi;
5. l'installazione in Home Assistant e la prova sul tablet.

Il tempo che serve davvero dipende soprattutto da quattro cose:

- **la grandezza della casa**, cioè quante stanze e quanti piani ha;
- **il materiale che dai all'AI**: con una piantina con le misure, foto chiare di ogni stanza e magari una scansione, l'AI lavora più in fretta e deve chiederti meno cose;
- **le aggiunte che chiedi tu**: il kit ti porta a una casa completa, con stanze, arredi, luci e dispositivi. Ogni cosa in più che chiedi oltre a questo richiede altro tempo, per esempio il giardino ricostruito pianta per pianta con la piscina e le luci esterne, oppure la libreria con i libri al loro posto;
- **i limiti di utilizzo del tuo abbonamento all'AI**, spiegati qui sotto.

**I limiti di utilizzo.** Gli abbonamenti alle AI hanno un limite di lavoro ogni poche ore e un limite settimanale. Quando lo raggiungi, l'AI si ferma e riparti quando il limite si azzera: nel caso del limite giornaliero dopo qualche ora, in quello settimanale anche dopo qualche giorno. La costruzione della casa stanza per stanza è la parte che consuma di più, perché l'AI guarda le tue foto, costruisce, controlla e corregge molte volte.

**Il calcolo delle luci, invece, non consuma i limiti.** Lo fa il computer da solo, anche di notte: tu lo lanci e la mattina dopo è pronto.

Alcuni esempi indicativi, con l'abbonamento più economico:

| Casa | Stanze | Tempo indicativo |
|---|---|---|
| Monolocale o bilocale, un piano | 2-4 | **2-3 giorni**, un paio d'ore al giorno |
| Appartamento, un piano | 5-7 | **circa una settimana** |
| Villetta su due piani | 8-12 | **1-2 settimane**: è probabile che una volta tu debba aspettare l'azzeramento del limite settimanale |
| Casa grande, tre piani o più | oltre 12 | **2-3 settimane** |

Con un abbonamento con limiti più alti ti fermi meno spesso, e i tempi si accorciano anche della metà. Con materiale incompleto, invece, si allungano, perché l'AI deve chiederti foto e misure in più.

---

## Come si comincia

1. **Scarica il kit.** In questa pagina premi il pulsante verde *Code*, poi *Download ZIP*, e scompatta il file in una cartella del tuo computer.
2. **Fai lavorare la tua AI dentro la cartella del kit.** Le AI che lavorano sul computer non vedono tutto il computer: lavorano dentro una cartella che scegli tu, e possono leggere e modificare solo i file che stanno lì dentro. Il kit funziona solo se l'AI lavora nella cartella che hai appena scompattato, perché è lì che trova tutti i file che le servono per costruire la tua casa.
   - **Se usi l'app della tua AI:** quando inizi una nuova conversazione, cerca il pulsante o la voce per scegliere la cartella su cui lavorare (di solito si chiama "Apri cartella", "Scegli cartella" o "Progetto") e seleziona la cartella del kit.
   - **Se usi la tua AI dal Terminale:** apri il Terminale, scrivi `cd ` seguito da uno spazio, trascina la cartella del kit dentro la finestra del Terminale e premi Invio. Poi avvia la tua AI scrivendo il suo comando.
   - **Per controllare che sia tutto a posto,** scrivi all'AI: "Quali file vedi in questa cartella?". Deve risponderti elencando, tra gli altri, `PROMPT.md`, `README.md` e le cartelle `blender` e `scheda_ha`. Se non li vede, l'AI sta lavorando nella cartella sbagliata: chiudi e ripeti questo passo.
3. **Apri il file [`PROMPT.md`](PROMPT.md)**, copia il testo dalla riga "INIZIO PROMPT" fino alla fine e incollalo all'AI come primo messaggio.
4. **Rispondi alle domande.** L'AI ti chiede una cosa alla volta e ti propone delle scelte: puoi prenderne una, scrivere la tua risposta oppure dire "decidi tu".

La prima cosa che ti farà vedere è una **casa d'esempio** già pronta, con un soggiorno e una cucina, così capisci subito come sarà la tua.

---

## Le domande che ti farà l'AI

Ecco alcuni esempi. Quando rispondi "decidi tu", l'AI sceglie e ti dice cosa ha scelto.

| Argomento | Esempio di domanda | Cosa puoi rispondere |
|---|---|---|
| **Piani** | "Quanti piani ha la casa e come li chiami?" | quanti ne hai, con i nomi che usi tu: taverna, piano terra, primo piano, mansarda… |
| **Scale** | "Dal primo piano vuoi vedere il piano terra attraverso l'apertura della scala?" | sì oppure no, per ogni piano |
| **Esterni** | "Hai giardino, terrazzi o balconi? A quale piano?" | anche più di uno, su piani diversi |
| **Soppalco** | "Vuoi il soppalco come stanza a sé, unito alla stanza sotto oppure non mostrato?" | una delle tre |
| **Materiali** | "Il pavimento del soggiorno me lo descrivi tu o lo scelgo io guardando le foto?" | per ogni stanza: lo descrivi tu, oppure decide l'AI |
| **Dispositivi** | "In cucina ho trovato queste luci nel tuo Home Assistant: quali vuoi sulla casa 3D?" | scegli tra le luci che hai davvero |
| **TV** | "La TV la accendi direttamente o con un box, per esempio una Apple TV?" | TV diretta, box, oppure nessuna TV |
| **Tablet** | "Su quali tablet userai la casa 3D?" | il modello e la dimensione dello schermo |

---

## Cosa sapere prima di iniziare

- **I muri si vedono bassi.** Serve a guardare dentro le stanze dall'alto. Quello che sta in basso o al centro della stanza si vede bene: mobili, letti, divani, lampade a sospensione. Quello che sta appeso in alto sul muro, come quadri, mensole alte e pensili, non si vede o si vede solo in parte.
- **Al massimo 10 lampade per stanza.** Il tablet riesce a gestire fino a 10 lampade nella stessa stanza, oppure nella stessa zona aperta, come un soggiorno unito alla cucina. Se ne hai di più, l'AI ti propone una soluzione. Per esempio, i sei faretti accesi dallo stesso interruttore possono diventare un'unica luce sulla casa 3D.
- **Solo dispositivi che esistono.** Ogni icona sulla casa corrisponde a un dispositivo vero del tuo Home Assistant e a un oggetto nel modello. Per esempio, l'icona del robot aspirapolvere sta sopra la sua base di ricarica.
- **I comandi sono quelli di Home Assistant.** Un tocco accende o spegne. Per regolare qualcosa, come la luminosità di una lampada, la temperatura del clima o l'apertura di una tapparella, si apre la normale finestra di Home Assistant che già conosci.
- **Le automazioni restano in Home Assistant.** Se vuoi che qualcosa succeda da solo, per esempio che il telo del proiettore scenda quando accendi il proiettore, lo imposti in Home Assistant come fai sempre. La casa 3D mostra solo cosa sta succedendo.

---

## Sicurezza

- L'AI **non inserisce mai password o chiavi di accesso**: gli accessi li fai sempre tu.
- Durante le prove l'AI **non comanda mai allarmi, serrature, cancelli o garage**.
- Prima di modificare una tua dashboard, l'AI **ne salva una copia**, e installa la casa 3D in Home Assistant **solo dopo il tuo sì**.
- Quando fai l'accesso per le prove, nella cartella `prove` viene creato il file `sessione-ha.json`, che contiene il tuo accesso a Home Assistant. Non condividerlo con nessuno.
- Se colleghi l'AI con la chiave di accesso, la chiave sta nel file `ha_accesso.json` nella cartella del kit. Anche questo file non va condiviso con nessuno.

---

## Cosa c'è nel kit

| Cartella o file | Cosa contiene |
|---|---|
| [`PROMPT.md`](PROMPT.md) | le istruzioni da dare all'AI: è da qui che si parte |
| [`LEGGIMI.md`](LEGGIMI.md) | la spiegazione tecnica, per l'AI e per chi è curioso |
| `blender/` | i pezzi con cui l'AI costruisce la casa (muri, porte, mobili, bagni, dispositivi) e la casa d'esempio |
| `modello_web/` | la casa pronta per Home Assistant: all'inizio contiene la casa d'esempio |
| `scheda_ha/` | la parte che si installa in Home Assistant |
| `prove/` | le prove automatiche, che controllano la casa 3D come la vedrebbe un iPad |
| `strumenti/` | un programma che rende il modello più leggero |

## Licenza

Distribuito con licenza [MIT](LICENSE).
