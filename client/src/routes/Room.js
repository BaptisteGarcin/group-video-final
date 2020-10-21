import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import styled from "styled-components";
import hark from "hark";

const Container = styled.div`
  padding: 20px;
  display: flex;
  height: 100vh;
  width: 90%;
  margin: auto;
  flex-wrap: wrap;
`;

const StyledVideo = styled.video`
  height: 40%;
  width: 50%;
`;

const Video = props => {
  const ref = useRef();

  useEffect(() => {
    props.peer.on("stream", stream => {
      ref.current.srcObject = stream;
    });
  }, []);

  return <video playsInline autoPlay ref={ref} />;
};

const videoConstraints = {
  height: window.innerHeight / 2,
  width: window.innerWidth / 2
};

const Room = props => {
  const [peers, setPeers] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const socketRef = useRef();
  const userVideo = useRef();
  const peersRef = useRef([]);
  const roomID = props.match.params.roomID;

  useEffect(() => {
    socketRef.current = io.connect("/");
    navigator.mediaDevices
      .getUserMedia({ video: videoConstraints, audio: true })
      .then(stream => {
        const options = {};
        const speechEvents = hark(stream, options);

        speechEvents.on("speaking", function() {
          console.log("speaking");
          setIsSpeaking(true);
        });

        speechEvents.on("stopped_speaking", function() {
          console.log("stopped_speaking");
          setIsSpeaking(false);
        });
        userVideo.current.srcObject = stream;
        socketRef.current.emit("join room", roomID);
        socketRef.current.on("all users", users => {
          const peers = [];
          users.forEach(userID => {
            const peer = createPeer(userID, socketRef.current.id, stream);
            peersRef.current.push({
              peerID: userID,
              peer
            });
            peers.push(peer);
          });
          setPeers(peers);
        });

        socketRef.current.on("user joined", payload => {
          const peer = addPeer(payload.signal, payload.callerID, stream);
          peersRef.current.push({
            peerID: payload.callerID,
            peer
          });

          setPeers(users => [...users, peer]);
        });

        socketRef.current.on("receiving returned signal", payload => {
          const item = peersRef.current.find(p => p.peerID === payload.id);
          item.peer.signal(payload.signal);
        });
      });
  }, []);

  function createPeer(userToSignal, callerID, stream) {
    const peer = new Peer({
      isSpeaking: false,
      initiator: true,
      trickle: false,
      stream
    });

    peer.on("signal", signal => {
      socketRef.current.emit("sending signal", {
        userToSignal,
        callerID,
        signal
      });
    });

    return peer;
  }

  function addPeer(incomingSignal, callerID, stream) {
    const peer = new Peer({
      isSpeaking: false,
      initiator: false,
      trickle: false,
      stream
    });

    peer.on("signal", signal => {
      socketRef.current.emit("returning signal", { signal, callerID });
    });

    peer.signal(incomingSignal);

    return peer;
  }

  return (
    <Container>
      <video muted ref={userVideo} autoPlay playsInline style={{ border: isSpeaking && "3px solid red", height: "40%", width: "50%" }}/>
      {peers.map((peer, index) => {
        return (
          <Video
            key={index}
            peer={peer}
            style={{ border: "1px solid black", height: "40%", width: "50%" }}
          />
        );
      })}
    </Container>
  );
};

export default Room;
