import { CountdownCircleTimer } from "react-countdown-circle-timer";

const Recording = () => {
    return (
        <CountdownCircleTimer
            isPlaying
            duration={5}
            colors={["#004777", "#F7B801", "#A30000", "#A30000"]}
            colorsTime={[7, 5, 2, 0]}
        >
            {({ remainingTime }) => remainingTime}
        </CountdownCircleTimer>
    );
};

export default Recording;
