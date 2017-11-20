'use strict';

var Server = require('ws').Server;
var ws = new Server({port: 3001});
var express = require('express'); 
var app = express(); 
var bodyParser = require('body-parser');
var fs = require('fs');
var multer = require('multer');

var mysql      = require('sync-mysql');
var connection = new mysql({
  host     : 'localhost',
  user     : 'root',
  password : '',
  database : 'farmacia'
});

app.use(bodyParser.json());

var client = null;
ws.on('connection', function(w){
  client = w;
});

function done(){
  client.send('done');
}


var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './upload/')
    },
    filename: function (req, file, cb) {
        var datetimestamp = Date.now();
        cb(null, file.fieldname + '-' + datetimestamp + '.' + file.originalname.split('.')[file.originalname.split('.').length -1])
    }
});

var upload = multer({
    storage: storage,
    fileFilter : function(req, file, callback) {
        if (['xls', 'xlsx'].indexOf(file.originalname.split('.')[file.originalname.split('.').length-1]) === -1) {
            return callback(new Error('Extensão inválida.'));
        }
        callback(null, true);
    }
}).single('file');


app.post('/upload', (req, res) => {
  upload(req, res, (err) => {
    if(err){
      console.log(new Error(err));
    }
    if(req.file){
      fs.readFile('./upload/' + req.file.filename, 'latin1', (err, data) => {
        if (err) throw err;
        data = data.replace(/<TR>/g, '&&LINEBREAK&&')
                 .replace(/<[^>]*>/g, '')
                 .replace(/   /g, '');
        var objects = [];
        var preObjects = data.split("&&LINEBREAK&&");
        preObjects = preObjects.splice(2);
        var dataConsolidado = req.file.originalname.split('.')[0];
        for(var k in preObjects){
          var obj = {};
          if(!preObjects[k].includes("TOTAL")){
            var parts = preObjects[k].split("\r\n");
            obj = {
              'nome_paciente' : parts[10] == ' &nbsp;' ? null : parts[10].trim(),
              'nasc_paciente' : parts[11] == ' &nbsp;' ? null : parts[11].trim(),
              'tel_paciente' : parts[12] == ' &nbsp;' ? null : parts[12].trim(),
              'medicamento' : parts[5] == ' &nbsp;' ? null : parts[5].trim(),
              'qtd_pres' : parts[6] == ' &nbsp;' ? null : parts[6].trim(),
              'qtd_disp' : parts[7] == ' &nbsp;' ? null : parts[7].trim(),
              'ini_val' : parts[9] == ' &nbsp;' ? null : parts[9].trim(),
              'fim_val' : parts[8] == ' &nbsp;' ? null : parts[8].trim(),
              'solicitante' : parts[13] == ' &nbsp;' ? null : parts[13].trim(),
              'dataConsolidado' : dataConsolidado == null ? "" : dataConsolidado
            }
            objects.push(obj);
          }
        }
        for(var i in objects){
          persistObject(objects[i], (i == objects.length - 1), res);
        }
      });
    } else {
      console.log('Erro: Arquivo não enviado.');
    }
  });
  //res.redirect('back');
});

function persistObject(obj, last){
  function insertPaciente(nome, data_nascimento, telefone_principal){
    console.log('Inserindo paciente');
    console.log('nome_paciente: ' + nome);
    var resultSetEndereco = connection.query("INSERT INTO endereco (id_endereco) VALUES (NULL)");
    var resultSetPaciente = connection.query("INSERT INTO paciente (nome, data_nascimento, telefone_principal, id_endereco) VALUES (?, ?, ?, ?)", [nome, data_nascimento, telefone_principal, resultSetEndereco.insertId]);
    console.log('Paciente inserido');
    return resultSetPaciente;
  }
  function insertMedicamento(nome){
    console.log('Inserindo medicamento');
    console.log('nome_medicamento: ' + nome);
    var resultSetMedicamento = connection.query("INSERT INTO medicamento (nome) VALUES (?)", [nome]);
    console.log('Medicamento inserido');
    return resultSetMedicamento;
  }
  function insertPrescricao(fim_val, ini_val, qtd_disp, qtd_pres, id_medicamento, id_paciente, solicitante, dataConsolidado){
    console.log('Inserindo prescricao');
    console.log('id_paciente: ' + id_paciente);
    console.log('id_medicamento: ' + id_medicamento);
    var resultSetPrescricao = connection.query("INSERT INTO prescricao (fim_validade, inicio_validade, quant_disponivel, quant_prescrita, id_medicamento, id_paciente, solicitante, dt_consolidacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [fim_val, ini_val, qtd_disp, qtd_pres, id_medicamento, id_paciente, solicitante, dataConsolidado]);
    console.log('id_prescricao: ' + resultSetPrescricao.insertId);
    console.log('Prescricao inserida');
    return resultSetPrescricao;
  }

  var resultGetPaciente = connection.query("SELECT * FROM paciente WHERE nome LIKE ?", [obj.nome_paciente]);
  var idPaciente;
  if(resultGetPaciente.length == 0){
    console.log('===================================================');
    console.log('Paciente não cadastrado');
    var resultSetPaciente = insertPaciente(obj.nome_paciente, obj.nasc_paciente, obj.tel_paciente);
    idPaciente = resultSetPaciente.insertId;
  } else {
    console.log('===================================================');
    console.log('Paciente encontrado');
    console.log('nome_paciente: ' + resultGetPaciente[0].nome);
    idPaciente = resultGetPaciente[0].id_paciente;
  }

  var resultGetMedicamento = connection.query("SELECT * FROM medicamento WHERE nome LIKE ?", [obj.medicamento]);
  var idMedicamento;
  if(resultGetMedicamento.length == 0){
    console.log('Medicamento não cadastrado');
    var resultSetMedicamento = insertMedicamento(obj.medicamento, obj.ini_val, obj.fim_val);
    idMedicamento = resultSetMedicamento.insertId;
  } else {
    console.log('Medicamento encontrado');
    console.log('nome_medicamento: ' + resultGetMedicamento[0].nome);
    idMedicamento = resultGetMedicamento[0].id_medicamento;
  }

  var resultSetPrescricao = insertPrescricao(obj.ini_val, obj.fim_val, obj.qtd_disp, obj.qtd_pres, idMedicamento, idPaciente, obj.solicitante, obj.dataConsolidado);

  if(last == true){
    done();
  }
}

app.get('/',function(req,res){
  res.end();
});

app.listen('3000', function(){
    console.log('Express server running on 3000');
    console.log('Websocket listen on 3001');
});